import express from 'express'
import http from 'http'
import path from 'path'
import bodyParser from 'body-parser'
import fluentFfmpeg from 'fluent-ffmpeg'
import pickBy from 'lodash/pickBy'
import fs from 'fs-extra'
import cors from 'cors'
import fileExtension from 'file-extension'
import io from 'socket.io'

import db from './database'
import ffmpeg from './ffmpeg'

const videoExtensions = ['mkv', 'm2ts']
const videosToEncodeFolder = process.env.ROOT_FOLDER_VIDEOS ? process.env.ROOT_FOLDER_VIDEOS : '/app/videos/to-encode'
const port = process.env.PORT ? process.env.PORT : 8080

const app = express()
app.use(cors())
app.use(express.static(videosToEncodeFolder))

const server = http.createServer(app)
const socket = io(server)
socket.on('connection', (client) => {
})


function convertMetadata(file, metadata) {
    console.log(metadata)
    const convert = {
        file,
        size: metadata.format.size,
        duration: metadata.format.duration,
        video: [],
        audio: [],
        subtitle: []
    }
    metadata.streams.forEach(stream => {
        switch (stream.codec_type) {
            case 'video':
                convert.video.push({
                    id: stream.id,
                    index: stream.index,
                    codec: stream.codec_name,
                    type: stream.codec_type
                })
                break
            case 'audio':
                convert.audio.push({
                    id: stream.id,
                    index: stream.index,
                    codec: stream.codec_name,
                    channel: stream.channel_layout,
                    language: stream.tags && stream.tags.language || null,
                    type: stream.codec_type
                })
                break
            case 'subtitle':
                convert.subtitle.push({
                    id: stream.id,
                    index: stream.index,
                    language: stream.tags && stream.tags.language || null,
                    type: stream.codec_type
                })
                break
            default:
                return
        }
    });
    return convert
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));


app.get('/fs', (req, res) => {
    const path = videosToEncodeFolder + req.query.path
    const response = []
    fs.readdir(path, (err, files) => {
        if (files) {
            files.forEach(fileName => {
                const file = path + fileName
                let stats = fs.lstatSync(file)
                if (stats.isFile()) {
                    if (videoExtensions.indexOf(fileExtension(file)) !== -1) {
                        response.push({ name: fileName, isDirectory: stats.isDirectory(), path: file.replace(videosToEncodeFolder, '') })
                    }
                } else {
                    response.push({ name: fileName, isDirectory: stats.isDirectory() })
                }
            })
        }
        res.send(response)
    })
})

app.get('/videos', (req, res) => {
    glob('**/*.?(mkv|m2ts)', { cwd: '/videos-to-encode', nocase: true })
        .then(videos => res.send(videos))
        .catch(err => {
            console.log(err)
            res.status(500).send(err)
        })
})

app.get('/videos/*', (req, res) => {
    const file = req.params[0]
    fs.pathExists(videosToEncodeFolder + file)
        .then(fileExists => {
            if (fileExists) {
                fluentFfmpeg.ffprobe(videosToEncodeFolder + file, function (err, metadata) {
                    if (err) {
                        throw err
                    }
                    res.send(convertMetadata(file, metadata))
                    
                })
            } else {
                const err = new Error()
                err.message = 'File does not exist: ' + file
                err.status = 404
                throw err
            }
        }).catch((err) => {
            res.status(err.status || 500).send(err)
        })
})

app.get('/encoder', (req, res) => {
    const encoder = db.get('encoder').value()
    res.send(encoder)
})

app.get('/queue', (req, res) => {
    const queue = db.get('queue').value()
    res.send(queue)
})

app.post('/encoder', (req, res) => {
    const { video } = req.body.element


    const command = fluentFfmpeg(videosToEncodeFolder + video.input)
                        .outputOptions(ffmpeg.convertUIOptionsIntoFFMPEGOptions(video.options))
                        .on('start', () => {
                            console.log('start')
                            db.set('encoder.status', 'processing')
                                .set('encoder.video', video)
                                .write()
                            socket.emit('encoder', db.get('encoder').value())

                        })
                        .on('progress', (progress) => {
                            const encoder = db.get('encoder').value();
                            const message = Object.assign({completion: progress}, encoder)
                            socket.emit('encoder', message)
                        })
                        .on('end', () => {
                            //notification de fin à l'UI par socket ?
                            // prochain element dans la queue ?
                            db.set('encoder', {status: 'stopped'})
                                .write()
                            db.get('queue')
                                .removeById(video.id)
                                .write()
                            socket.emit('encoder', db.get('encoder').value())
                            socket.emit('queue', db.get('queue').value())
                            console.log('end')
                        })
                        .on('error', (error) => {
                            db.set('encoder.status', 'error')
                                .set('encoder.error', error)
                                .write()
                            console.error(error)
                        })
                        .save(videosToEncodeFolder + video.output)
    
    res.send('OK')
})

app.get('/encoder/formats', (req, res) => {
    ffmpeg.getAvailableFormats(function (err, formats) {
        res.send(pickBy(formats, format => format.canDemux && format.canMux))
    });
})

app.get('/encoder/codecs', (req, res) => {
    const filter = req.query.type
    ffmpeg.getAvailableCodecs(function (err, codecs) {
        res.send(pickBy(codecs, codec => codec.canEncode && codec.type == filter))
    });
})

app.get('/settings/codecs', (req, res) => {
    const encoder = db.get('settings').value()
    res.send(encoder.codecs)
})

app.get('/encoder/filters', (req, res) => {
    ffmpeg.getAvailableFilters(function (err, codecs) {
        res.send(pickBy(codecs, filter => true))
    });
})

app.get('/queue', (req, res) => {
    const queue = db.get('queue').value();
    res.send(queue)
})

app.post('/queue', (req, res) => {
    const { video, options } = req.body.element
    const videoPath = path.dirname(video)
    const output =  (videoPath == '/' ? videoPath : videoPath + '/') + 'encoder_'+ path.basename(video, path.extname(video)) +'.mkv'
    const element = db.get('queue')
        .insert({
            input: video,
            output,
            options: options
        })
        .write()
    socket.emit('queue', db.get('queue').value())
    res.status(201).send(element)
})

server.listen(port, () => {
    console.log('Server launched on ' + port)
})
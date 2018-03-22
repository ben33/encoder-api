import express from 'express'
import bodyParser from 'body-parser'
import ffmpeg from 'fluent-ffmpeg'
import pickBy from 'lodash/pickBy'
import fs from 'fs-extra'
import cors from 'cors'
import fileExtension from 'file-extension'

import db from './database'

const videoExtensions = ['mkv', 'm2ts']
const server = express()
server.use(cors())
const port = process.env.PORT ? process.env.PORT : 8080
const videosToEncodeFolder = process.env.ROOT_FOLDER_VIDEOS ? process.env.ROOT_FOLDER_VIDEOS : '/app/videos/to-encode'

server.use(express.static(videosToEncodeFolder))

function convertMetadata(file, metadata) {
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
                    index: stream.index,
                    codec: stream.codec_name
                })
                break
            case 'audio':
                convert.audio.push({
                    index: stream.index,
                    codec: stream.codec_name,
                    channel: stream.channel_layout,
                    language: stream.tags && stream.tags.language || null
                })
                break
            case 'subtitle':
                convert.subtitle.push({
                    index: stream.index,
                    language: stream.tags && stream.tags.language || null
                })
                break
            default:
                return
        }
    });
    return convert
}

server.use(bodyParser.json());
server.use(bodyParser.urlencoded({
    extended: true
}));


server.get('/fs', (req, res) => {
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

server.get('/videos', (req, res) => {
    glob('**/*.?(mkv|m2ts)', { cwd: '/videos-to-encode', nocase: true })
        .then(videos => res.send(videos))
        .catch(err => {
            console.log(err)
            res.status(500).send(err)
        })
})

server.get('/videos/*', (req, res) => {
    const file = req.params[0]
    fs.pathExists(videosToEncodeFolder + file)
        .then(fileExists => {
            if (fileExists) {
                ffmpeg.ffprobe(videosToEncodeFolder + file, function (err, metadata) {
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

server.get('/encoder', (req, res) => {
    const encoder = db.get('encoder').value()
    res.send(encoder)
})

server.get('/encoder/formats', (req, res) => {
    ffmpeg.getAvailableFormats(function (err, formats) {
        res.send(pickBy(formats, format => format.canDemux && format.canMux))
    });
})

server.get('/encoder/codecs', (req, res) => {
    const filter = req.query.type
    ffmpeg.getAvailableCodecs(function (err, codecs) {
        res.send(pickBy(codecs, codec => codec.canEncode && codec.type == filter))
    });
})

server.get('/settings/codecs', (req, res) => {
    const encoder = db.get('settings').value()
    res.send(encoder.codecs)
})

server.get('/encoder/filters', (req, res) => {
    ffmpeg.getAvailableFilters(function (err, codecs) {
        res.send(pickBy(codecs, filter => true))
    });
})

server.post('/encoder/queue', (req, res) => {
    const { video, form } = req.body
    const queue = db.get('encoder.queue')
        .push({
            video,
            options: convertFormIntoOptions(form)
        })
        .write()
    res.status(201).send(queue)
})

function convertFormIntoOptions(plop) {
    return plop
}

server.listen(port, () => {
    console.log('Server launched on ' + port)
})
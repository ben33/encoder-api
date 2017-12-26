import express from 'express'
import bodyParser from 'body-parser'
import ffmpeg from 'fluent-ffmpeg'
import glob from 'glob-promise'
import fs from 'fs-extra'

import db from './database'

const server = express()
const port = process.env.PORT ? process.env.PORT : 8080

function convertMetadata(file, metadata){
    const convert = {
        file,
        size: metadata.format.size,
        duration: metadata.format.duration,
        video: [],
        audio: [],
        subtitle: []
    }
    metadata.streams.forEach(stream => {
        switch(stream.codec_type){
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
                    language: stream.tags && stream.tags.language || 'N/A'
                })
                break
            case 'subtitle':
                convert.subtitle.push({
                    index: stream.index,
                    language: stream.tags && stream.tags.language || 'N/A'
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

server.get('/videos', (req, res) => {
    glob('**/*.?(mkv|m2ts)', {cwd: '/videos-to-encode', nocase: true})
        .then(videos => res.send(videos))
        .catch(err => {
            console.log(err)
            res.status(500).send(err)
        })
})

server.get('/videos/*', (req, res) => {
    const file = req.params[0]
    fs.pathExists('/videos-to-encode/' + file)
        .then(fileExists => {
            if(fileExists){
                ffmpeg.ffprobe('/videos-to-encode/' + file, function(err, metadata) {
                    if(err){
                        throw err
                    }
                    res.send(convertMetadata(file, metadata))
                })
            }else{
                const err = new Error()
                err.message = 'File does not exist: '+ file
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

server.post('/encoder/queue', (req, res) => {
    const {video, form} = req.body
    const queue = db.get('encoder.queue')
                    .push({
                        video,
                        options: convertFormIntoOptions(form)
                    })
                    .write()
    res.status(201).send(queue)
})

function convertFormIntoOptions(plop){
    return plop
}

server.listen(port, () => {
    console.log('Server launched on ' + port)
})
const should = require('chai').should()
const pick = require('lodash/pick')
const ffmpeg = require('../src/ffmpeg.mjs')

const optionsTest = {
    "0": {
        "type": "video",
        "quality": 22,
        "preset": "slow",
        "encoding": "libx265"
    },
    "1": {
        "type": "audio",
        "encoding": "copy",
        "language": "fre"
    },
    "5": {
        "type": "subtitle",
        "encoding": "copy"
    },
    "6": {
        "type": "audio",
        "encoding": "ac3"
    },
    "10": {
        "type": "subtitle",
        "encoding": "copy",
        "language": "eng"
    }
}

describe('convertUIOptionsIntoFFMPEGOptions', () => {

    it('should return an array with encoding copy', () => {
        ffmpeg.convertUIOptionsIntoFFMPEGOptions(pick(optionsTest, '5')).should
        .be.an('array')
        .and.to.deep.equal(['-map 0:5', '-c:s:0 copy']);
    })

    it('should return a array with encoding ac3', () => {
        ffmpeg.convertUIOptionsIntoFFMPEGOptions(pick(optionsTest, '6')).should
        .be.an('array')
        .and.to.deep.equal(['-map 0:6','-c:a:0 ac3']);
    })

    it('should return a array with encoding libx265, preset and quality', () => {
        ffmpeg.convertUIOptionsIntoFFMPEGOptions(pick(optionsTest, '0')).should
        .be.an('array')
        .and.to.deep.equal(['-map 0:0', '-c:v:0 libx265', '-preset slow', '-crf 22']);
    })

    it('should return a array with all', () => {
        ffmpeg.convertUIOptionsIntoFFMPEGOptions(optionsTest).should
        .be.an('array')
        .and.to.deep.equal(['-map 0:0','-map 0:1','-map 0:5','-map 0:6','-map 0:10',
        '-c:v:0 libx265', '-preset slow', '-crf 22',
        '-c:a:0 copy',
        '-metadata:s:a:0 language=fre',
        '-c:s:0 copy',
        '-c:a:1 ac3',
        '-c:s:1 copy',
        '-metadata:s:s:1 language=eng'
        ]);
    })

})
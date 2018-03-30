import forEach from 'lodash/forEach'
// const forEach = require('lodash/forEach')

const convertUIOptionsIntoFFMPEGOptions = (options) => {
    let optionsConverted = []
    let maps = {
        audio: {
            code: 'a',
            count: 0
        },
        video: {
            code: 'v',
            count: 0
        },
        subtitle: {
            code: 's',
            count: 0
        },
    }
    forEach(options, (option, index) => {
        if(option.id){
            optionsConverted.push('-map i:' + option.id)
        }else{
            optionsConverted.push('-map 0:' + index)
        }
    })
    forEach(options, (option, index) => {
        optionsConverted.push('-c:' + maps[option.type].code + ':' + maps[option.type].count + ' ' + option.encoding)
        if (option.preset) {
            optionsConverted.push('-preset ' + option.preset)
        }
        if (option.quality) {
            optionsConverted.push('-crf ' + option.quality)
        }
        if (option.language) {
            optionsConverted.push('-metadata:s:' + maps[option.type].code + ':' + maps[option.type].count + ' language=' + option.language)
        }
        maps[option.type].count++
    })
    console.log(optionsConverted)
    return optionsConverted
}

const ffmpeg = {
    convertUIOptionsIntoFFMPEGOptions
}
// module.exports = ffmpeg
export default ffmpeg
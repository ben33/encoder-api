import lowdb from 'lowdb'
import FileSync from 'lowdb/adapters/FileSync'
import lodashId from 'lodash-id'

const adapter = new FileSync('/app/db.json')
const db = lowdb(adapter)
db._.mixin(lodashId)

db.defaults({
    settings: {
        codecs: {
            audio: [
                {key: 'aac', text: 'aac'},
                {key: 'ac3', text: 'ac3'}
            ],
            video: [
                {key: 'libx265', text: 'libx265'},
                {key: 'libx264', text: 'libx264'}
            ]
        }
    },
    encoder: {
        status: 'stopped'
    },
    queue:[]
})
.write()

export default db

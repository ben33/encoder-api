import lowdb from 'lowdb'
import FileSync from 'lowdb/adapters/FileSync'

const adapter = new FileSync('/media/db.json')
const db = lowdb(adapter)

db.defaults({
    presets: [
        {
            name: 'h265 - 1pass',
            options: ['-c:v libx265', '-crf 22', '-c:a aac', '-b:a 128k']
        }
    ],
    encoder: {
        status: 'stopped',
        queue:[]
    }
})
.write()

export default db

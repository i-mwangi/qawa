import { getLmdb } from './lmdb-shim'
const lmdb: any = getLmdb()
import fs from 'node:fs'
import path from 'node:path';
import { StoreReadStream, StreamOptions } from './stream';

const env = new lmdb.Env()
let isOpen = false

const network = process.env.NETWORK ?? 'testnet'
const isTestnet = network === 'testnet'



export default class Store{
    db: any


    constructor(db: any) {
        this.db = db;
    }


    static init(name: string, customPath?: string) {
        let dir_name = path.join(process.cwd(), isTestnet ? "local-store/store" : 'store')
        let dirExists = fs.existsSync(dir_name)

        if(!dirExists){
            fs.mkdirSync(dir_name)
            console.log("CREATED STORE DIRECTORY")
        } 

        if(!isOpen){
            env.open({
                path: dir_name,
                maxDbs: 10,
                mapSize: 2 * 1024 * 1024 * 1024 // 2GB
            })
            isOpen =true
        }

        let db = env.openDbi({
            name,
            create: true
        })


        return new Store(db)
    }

    setObject<D = any>(key: string, value: D) {
        console.log("Setting object::", value)
        let stringified = JSON.stringify(value, (k, v) => {
            if (typeof v === 'bigint') {
                return Number(v)
            }
            return v
        })
        this.set(key, stringified)
    }

    getObject<D = any>(key: string) {
        let stringified = this.get(key);
        const data = JSON.parse(stringified)
        return data as D
    }

    set(key: string, vaulue: string){
        const txn = env.beginTxn()
        txn.putString(this.db, key, vaulue)
        txn.commit()
    }

    get(key: string){
        const txn = env.beginTxn({
            readOnly: true
        })
        const data = txn.getString(this.db, key)
        txn.commit()
        return data
    }

    getCursor(key: string) {
        const txn = env.beginTxn({
            readOnly: true
        })

        const cursor = new lmdb.Cursor(txn, this.db, {
            keyIsString: true
        })

        let found = cursor.goToKey(key)
        if (!found) {
            cursor.close()
            return null
        }

        return {
            cursor,
            txn
        }
    }

    // !!! TEST ONLY ⚠️⚠️
    dump(){
        this.db.drop({
            justFreePages: true
        })

        this.db.close()
    }

    printDB(){
        const txn = env.beginTxn({
            readOnly: true
        })

        const cursor = new lmdb.Cursor(txn, this.db, {
            keyIsString: true
        })

        let found = cursor.goToFirst()
        while(found){
            const key = found;
            console.log(found, cursor.getCurrentString())
            found = cursor.goToNext()
        }

        cursor.close()
        txn.commit()
    }


    createStream(options?: StreamOptions) {
        const stream = new StoreReadStream(env, this.db, options)
        return stream
    }

}
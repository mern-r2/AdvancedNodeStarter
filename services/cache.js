const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);
client.get = util.promisify(client.get);
const exec = mongoose.Query.prototype.exec;

client.flushall('ASYNC', console.log);
mongoose.Query.prototype.cache = function() {
  this.useCache = true;

  return this;
}

mongoose.Query.prototype.exec = async function(){
  if(!this.useCache){
    return exec.apply(this, arguments);
  }

  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name
    })
  );

  // check for response result in cache first
  const cacheValue = await client.get(key);
  if(cacheValue){
    const doc = JSON.parse(cacheValue);

    if(Array.isArray(doc)){
      return doc.map(d => new this.model(d));
    }

    return new this.model(doc);
  }
  
  // query db if cache miss
  const result = await exec.apply(this, arguments);
  client.set(key, JSON.stringify(result));

  return result;
}
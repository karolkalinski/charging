const Influx = require('influx')
const express = require('express')
const bodyParser = require('body-parser');
const http = require('http')
const os = require('os')
const port = process.env.PORT || 3001;
const { createClient } = require('redis');

const app = express()
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: true }));

const influx = new Influx.InfluxDB({
  host: 'localhost',
  database: 'home',
  schema: [
    {
      measurement: 'charging_sessions',
      fields: {
        path: Influx.FieldType.STRING,
        duration: Influx.FieldType.INTEGER
      },
      tags: [
        'host'
      ]
    }
  ]
})


function usage(resp) {
	return influx.query('select max(car_consumption) from five_years.total')
  .then(result => {
    return result[0].max
  }).catch(err => {
    resp.status(500).send(err.stack)
  })
}

function distance(resp) {
	return influx.query('select * from five_years.charging_session order by time desc limit 1')
  .then(result => {
    return result[0].distance
  }).catch(err => {
    resp.status(500).send(err.stack)
  })
}

app.post('/start', async (req, resp) => {
	console.log("Start");
	const { distance } = req.body;
	console.log(distance); 
	const currentUsage = await usage(resp);
	console.log(usage);
	influx.writePoints(
		[{
			measurement: "charging_session", 
			tags: { action: "start", distance: parseInt(distance, 10)},
			 fields: { usage: currentUsage}}], 
		{ retentionPolicy: "five_years" }).catch(err => {
      console.error(`Error saving data to InfluxDB! ${err.stack}`)
    })
	resp.send("done");
})

app.post('/stop', async (req, resp) => {
	console.log("Stop");
	const body = req.body;
	console.log(body); 
	const currentUsage = await usage(resp);
	const lastDistance = await distance(resp);
	console.log(usage);
	influx.writePoints([{
		measurement: "charging_session", 
		tags: { action: "stop", distance: lastDistance }, 
		fields: { usage: currentUsage },
	}], { retentionPolicy: "five_years" }).catch(err => {
      console.error(`Error saving data to InfluxDB! ${err.stack}`)
    })
	resp.send("done");
})

app.get('/usage', async (req, resp) => {
	const client = await createClient({url: 'redis://red-csbp731u0jms73fg5nlg:6379'})
  		.on('error', err => console.log('Redis Client Error', err))
  		.connect();
	
	await client.set('key', 'value');
	const value = await client.get('key3');
	await client.disconnect();

	console.log(await usage(resp));
	resp.send((await usage(resp)).toString());	
});



    http.createServer(app).listen(port, function () {
      console.log('Listening request on port' + port)
    })

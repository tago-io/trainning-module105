const { Account, Analysis, Utils, Services } = require("@tago-io/sdk");
const { queue } = require("async");
const { parse } = require("json2csv");

const deviceReadings = [];
async function getDeviceTemperature({ deviceObj, account } = { account: new Account() }) {
  const [temperature] = await account.devices.getDeviceData(deviceObj.id, { variables: "temperature", qty: 1 });

  if (!temperature) {
    return;
  }

  deviceReadings.push({
    name: deviceObj.name,
    temperature: temperature.value,
    unit: temperature.unit,
    last_reading: temperature.time,
  })
}

async function startAnalysis(context) {
  const envVariables = Utils.envToJson(context.environment);

  const account = new Account({ token: envVariables.profile_token });

  const deviceList = await account.devices.list({
    amount: 50,
    fields: ["id", "name", "tags"],
    filter: {
      tags: [
        { key: "device_type", value: "sensor" },
      ]
    }
  });

  const deviceQueue = queue(getDeviceTemperature, 3);
  deviceQueue.error((e) => console.error(e));

  deviceList.forEach((deviceObj) => {
    deviceQueue.push({ deviceObj, account });
  });

  await deviceQueue.drain();

  let csv;
  try {
    csv = parse(deviceReadings, { fields: ["name", "temperature", "unit", "last_reading"] });
    console.log(csv);
  } catch (e) {
    console.error(e);
  }

  if (!csv) {
    return;
  }

  const emailService = new Services({ token: context.token }).email;
  const result = await emailService.send({
    to: "vitorfdl@tago.io",
    subject: "My First Report",
    message: "Download your device temperature readings",
    attachment: {
      archive: csv,
      filename: "report.csv"
    }
  });

  console.log(result);

}

module.exports = new Analysis(startAnalysis, { token: "c9dd26a7-323a-45b3-b6fa-2c67b3cecac3" });
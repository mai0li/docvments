const puppeteer = require('puppeteer');
const fs = require('fs');


var start_date = new Date();
start_date.setDate(start_date.getDate() - 7);
let start_date_string = String(start_date.getDate()).padStart(2, '0') + String(start_date.getMonth() + 1).padStart(2, '0') + String(start_date.getFullYear());
let end_date = new Date();
let end_date_string = String(end_date.getDate()).padStart(2, '0') + String(end_date.getMonth() + 1).padStart(2, '0') + String(end_date.getFullYear());

console.log("debug");

(async () => {
  var today = new Date();
  const browser = await puppeteer.launch({ headless: true, slowMo: 20, }); //spawns chromium. change headless if you wanna see it popping
  page = (await browser.pages())[0];
  await page.setViewport({ 'width': 1920, 'height': 1080 });
  await page._client.send('Emulation.clearDeviceMetricsOverride');
  await page.setUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'); //ever wanted to be a 1.6T dollar company?
  await page.setDefaultNavigationTimeout(0);
  await page.goto('https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx', { waitUnil: 'networkidle0' }); //url


  //inputs
  await page.evaluate(() => {
    var periodCheck = document.querySelector('input#rdPeriodo');
    periodCheck.click();
  })
  await page.type('input#txtDataIni', start_date_string);
  await page.type('input#txtDataFim', end_date_string);
  await page.evaluate(() => {
    var button = document.querySelector('input#btnConsulta');
    button.click();
  })

  //requires existing file. beware
  await saveAndExit(await prep(await crawl()), './Documentos Entregues a CVM - Consolidado.csv');

  //waitForResponse after recaptcha's webworker solves its challenge,
  //effectively simulating a legitimate browser.
  //grabs all the available data for the day, in a similar way an API would've done.
  async function crawl() {
    try {
      let [response] = await Promise.all([
        page.waitForResponse(response => response.url().includes('/ListarDocumentos'))
      ]);
      let dataObj = await response.json();
      return dataObj.d.dados; //jackpot  
    } catch (error) {
      console.log(error);
    }

  }

  //data prepping
  async function prep(data) {
    let lines_regex = /\$\&\&\*/g;
    let separator_regex = /\$\&/g;

    let stage1 = data.replace(lines_regex, '\n');
    let stage2 = stage1.replace(separator_regex, '\t');
    let stage3 = stage2.replace(/\<spanOrder\>(.*?)\<\/spanOrder\>/g, '');
    let visualizer = stage3.replace(/(.*?\t.*?\t.*?\t.*?\t.*?\t.*?\t.*?\t.*?\t.*?\t.*?)\t(.*VisualizarDocumento.*?(onclick=(OpenPopUpVer\(\'(.*?)\')*.*?\)).*?)*(.*)/g,
    '$1\thttps\:\/\/www\.rad\.cvm\.gov\.br\/ENET\/$5\t$6');
    let downloader = visualizer.replace(/(.*)\t.*fi-download.*(OpenDownloadDocumentos\(\'([0-9]+)\'\,\'([0-9]+)\'\,\'([0-9A-Z\-]+)\'\,\'(.*?)\'\))(.*mostraLocaisPublicacao\(\'.*\@\!\@(.*?)\@\!\@(.*?)\@\!\@(.*?)\'.*)*.*\t(.*)/g,
    '$1\t$3\t$4\t$5\t$6\t$8\t$9\t$10\t$11');
    let stage5 = downloader.replace(/\"/g,'\'');
    let stage6 = stage5.replace(/(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t ([0-9]{2})\/([0-9]{2})\/([0-9]{4})( [0-9]{2}:[0-9]{2})\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\t(.*?)\n/g,
      '"$1","$2","$3","$4","$5","$6","$9\/$8\/$7$10","$11",$12,"$13","$14",$15,$16,"$17","$18","$19","$20","$21","$22"\n'
    );

    let stage7 = stage6.replace(/\" | \"/g, '"');
    return stage7;
  }

  // async function saveToday(content) {
  //   var header = '\uFEFF' + 'Código CVM	Empresa	Categoria	Tipo	Espécie	Data Referência	Data Entrega	Status	V	Modalidade	URL	numSequencia	numVersao	numProtocolo	descTipo	Publicação - URL	Publicação - Data	Publicação - UF	Assunto\n';
  //   fs.writeFileSync('./' + String(today.getFullYear()) + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0') + 'T' + String(today.getHours()) + '-' + String(today.getMinutes()) + ' - Documentos Entregues à CVM 2.tsv', header, 'utf16le');
  //   fs.appendFileSync('./' + String(today.getFullYear()) + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0') + 'T' + String(today.getHours()) + '-' + String(today.getMinutes()) + ' - Documentos Entregues à CVM 2.tsv', content, 'utf16le');
  // }

  async function saveAndExit(content, filename) {

    fs.appendFileSync(filename, content);
    console.log('We out here');
    await browser.close();
  }
  
})();
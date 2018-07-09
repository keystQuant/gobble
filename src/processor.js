String.prototype.format = function() {
  // es5 synatax
  // finds '{}' within string values and replaces them with
  // given parameter values in the .format method
  var formatted = this
  for (var i = 0; i < arguments.length; i++) {
      var regexp = new RegExp('\\{'+i+'\\}', 'gi')
      formatted = formatted.replace(regexp, arguments[i])
  }
  return formatted
}

class Processor {

  constructor(data='') {
    this.data = data
  }

  setData(data) {
    this.data = data
  }

  async processMassDate() {
    let datesData = ['mass_date']

    for (let obj of this.data.Data) {
      for (let jsonData of obj) {
        let dateData = jsonData.TRD_DT.replace(/\./gi, '').trim()
        datesData.push(dateData)
      }
    }

    return datesData
  }

  async processMassIndex(date) {
    let jsonDate = date

    let indexData = ['mass_index']
    for (let obj of this.data.Data) {
      for (let json of obj) {
        let jsonMashed = `{0}|{1}|{2}|{3}|{4}|{5}|{6}|{7}|{8}`.format(
            jsonDate,
            json['U_CD'],
            json['U_NM'],
            json['STRT_PRC'],
            json['HIGH_PRC'],
            json['LOW_PRC'],
            json['CLS_PRC'],
            json['TRD_QTY'],
            json['TRD_AMT']
        ) // fill in semi colon separated string
        indexData.push(jsonMashed)
      } // inner for loop
    } // outer for loop

    return indexData
  }

  async processMassOHLCV(date) {
    let jsonDate = date

    let ohlcvData = ['mass_ohlcv']
    for (let obj of this.data.Data) {
      for (let json of obj) {
        let jsonMashed = `{0}|{1}|{2}|{3}|{4}|{5}|{6}|{7}|{8}|{9}|{10}`.format(
            jsonDate,
            json['GICODE'],
            json['GINAME'],
            json['STRT_PRC'],
            json['HIGH_PRC'],
            json['LOW_PRC'],
            json['CLS_PRC'],
            json['ADJ_PRC'],
            json['TRD_QTY'],
            json['TRD_AMT'],
            json['SHTSALE_TRD_QTY']
        ) // fill in semi colon separated string
        ohlcvData.push(jsonMashed)
      } // inner for loop
    } // outer for loop

    return ohlcvData
  }

  async processMassBuysell(date) {
    let jsonDate = date

    let buysellData = ['mass_buysell']
    for (let obj of this.data.Data) {
      for (let json of obj) {
        let jsonMashed = `{0}|{1}|{2}|{3}|{4}|{5}|{6}|{7}|{8}|{9}|{10}|{11}|{12}|{13}|{14}|{15}|{16}|{17}|{18}|{19}|{20}`.format(
            jsonDate,
            json['GICODE'],
            json['GINAME'],
            json['FORGN_B'],
            json['FORGN_S'],
            json['FORGN_N'],
            json['PRIVATE_B'],
            json['PRIVATE_S'],
            json['PRIVATE_N'],
            json['INST_SUM_B'],
            json['INST_SUM_S'],
            json['INST_SUM_N'],
            json['TRUST_B'],
            json['TRUST_S'],
            json['TRUST_N'],
            json['PENSION_B'],
            json['PENSION_S'],
            json['PENSION_N'],
            json['ETC_INST_B'],
            json['ETC_INST_S'],
            json['ETC_INST_N']
        ) // fill in semi colon separated string
        buysellData.push(jsonMashed)
      } // inner for loop
    } // outer for loop

    return buysellData
  }

  async processMassFactor(date) {
    let jsonDate = date

    let factorData = ['mass_factor']
    for (let obj of this.data.Data) {
      for (let json of obj) {
        let jsonMashed = `{0}|{1}|{2}|{3}|{4}|{5}|{6}|{7}`.format(
            jsonDate,
            json['GICODE'],
            json['ITEMABBRNM'],
            json['PER'],
            json['PBR'],
            json['PCR'],
            json['PSR'],
            json['DIVID_YIELD']
        ) // fill in semi colon separated string
        factorData.push(jsonMashed)
      } // inner for loop
    } // outer for loop

    return factorData
  }

}

module.exports = {
  Processor: Processor
}

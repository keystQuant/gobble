let testVar = {}

beforeAll(async () => {
  testVar.value = 'this is a test string value'
})

afterAll(() => {
  console.log('ran test successfully')
})

describe('javascript test with travis', () => {

  test('first test', async () => {
    expect(testVar.value).toBe('this is a test string value')
  }, 16000)

  test('second test', async () => {
    let testVar = 'this is a test variable'
    expect(testVar).toBe('this is a test variable')
  }, 16000)

})

describe('second test scope', () => {

  test('travis works', async () => {
    let travisWorked = true
    expect(travisWorked).toBe(true)
  }, 16000)

})

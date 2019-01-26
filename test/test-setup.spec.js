const sinon = require('sinon'),
    chai = require('chai');

beforeEach(() => {
   this.sandbox = sinon.createSandbox();
   rewiremock.enable();
});

afterEach(() => {
    this.sandbox.restore();
    rewiremock.disable();
});
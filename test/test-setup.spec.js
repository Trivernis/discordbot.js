const sinon = require('sinon'),
    chai = require('chai'),
    rewiremock = require('rewiremock').default;

beforeEach(() => {
   this.sandbox = sinon.createSandbox();
   rewiremock.enable();
});

afterEach(() => {
    this.sandbox.restore();
    rewiremock.disable();
});
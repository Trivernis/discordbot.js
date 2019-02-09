/* eslint-disable */
const sinon = require('sinon'),
    chai = require('chai');

beforeEach(() => {
   this.sandbox = sinon.createSandbox();
});

afterEach(() => {
    this.sandbox.restore();
});

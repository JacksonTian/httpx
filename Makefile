TESTS = $(shell ls -S `find test -type f -name "*.test.js" -print`)
REPORTER = spec
TIMEOUT = 3000
PATH := ./node_modules/.bin:$(PATH)
MOCHA = ./node_modules/mocha/bin/_mocha
MOCHA_OPTS =

test:
	@mocha --require co-mocha \
		--reporter $(REPORTER) \
		--timeout $(TIMEOUT) \
		$(MOCHA_OPTS) \
		$(TESTS)

test-cov:
	@istanbul cover --report html \
		$(MOCHA) -- \
		--require co-mocha \
		--reporter $(REPORTER) \
		--timeout $(TIMEOUT) \
		$(MOCHA_OPTS) \
		$(TESTS)

test-coveralls:
	@istanbul cover --report lcovonly \
		$(MOCHA) -- \
		--require co-mocha \
		--reporter $(REPORTER) \
		--timeout $(TIMEOUT) \
		$(MOCHA_OPTS) \
		$(TESTS)
	@echo TRAVIS_JOB_ID $(TRAVIS_JOB_ID)
	@cat ./coverage/lcov.info | coveralls && rm -rf ./coverage

.PHONY: test

#!/bin/sh

for filename in $@; do cat $filename; echo; done

metrics
=======

*See what your application internals are doing in doing in real-time*

* Aggregate counters, numbers, times
* Send data from any system or application
* Built in dashboard to view your aggregated stats

### Quick start

1. $ git clone https://github.com/prawnsalad/metrics.git
2. $ npm install
3. $ node server.js

You should now be able to view your dashboard at http://127.0.0.1:5000/

### Getting data into metrics
metrics uses UDP sockets to read data over the network as fast as possible. Your application can send UDP data and forget about it - it's very fast and very simple.

By default metrics is listening for data on all interfaces, port 1234.

Data format: namespaced.bucket value

*Data Examples*
* website.logins 1
* website.logouts 1
* website.http.response_time 610
* website.http.responses.200 1
* website.http.responses.404 1
* website.http.responses.503 1
* website.errors.warning 1
* website.errors.fatal 1


### Internal metrics
By default, metrics will store internal statistics of its own under the 'internal.' namespace. These include:
* internal.server.memory.rss
* internal.server.memory.heap_used
* internal.server.memory.heap_total
* internal.events.stored

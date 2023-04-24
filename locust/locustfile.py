from locust import HttpUser, task
from urllib.parse import quote_plus
from random import choice

urls = [ 'http://code.jquery.com/jquery-2.1.3.min.js',
         'http://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/js/bootstrap.min.js',
         'http://cdnjs.cloudflare.com/ajax/libs/jquery/2.1.3/jquery.min.js',
         'http://google.com',
         'http://facebook.com',
         'http://twitter.com',
         'http://github.com',
         'http://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js' ]

class User(HttpUser):
    def on_start(self):
	self.target_url = choice(urls)
        pass
    @task
    def request(self):
        self.client.get('/?' + quote_plus(self.target_url))

class WebsiteUser(HttpUser):
    task_set = User
    min_wait = 0
    max_wait = 1000

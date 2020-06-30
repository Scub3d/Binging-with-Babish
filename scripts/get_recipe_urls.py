# -*- coding: utf-8 -*-
import requests

try: 
	from BeautifulSoup import BeautifulSoup
except ImportError:
	from bs4 import BeautifulSoup

base_url = "https://www.bingingwithbabish.com"
recipes_url = "https://www.bingingwithbabish.com/recipes"

def get_recipes(url): # gets urls to all recipes on the website
	html = requests.get(url).text	
	parsed_html = BeautifulSoup(html, features="html5lib")
	recipe_cols = parsed_html.body.find_all('div', class_='recipe-col')
	file = open('recipe_urls.txt', 'w') # create a file to store them in

	for recipe_index in range(0, len(recipe_cols)):
		file.write(base_url + recipe_cols[recipe_index].find('a', href=True)['href']) # write the hrefs to a new line

		if recipe_index < len(recipe_cols) - 1: # if last line, don't write a \n
			file.write("\n")
	file.close()

if __name__ == "__main__":
	get_recipes(recipes_url)
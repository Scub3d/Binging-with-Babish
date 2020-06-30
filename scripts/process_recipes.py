# -*- coding: utf-8 -*-

import requests, os, firebase_admin, time, datetime, uuid, bs4
from firebase_admin import credentials, firestore, storage
from PIL import Image
from secrets import gcloud_project_id

try: 
	from BeautifulSoup import BeautifulSoup
except ImportError:
	from bs4 import BeautifulSoup

base_url = "https://www.bingingwithbabish.com"
recipes_url = "https://www.bingingwithbabish.com/recipes"

recipe_urls_text_file = "recipe_urls.txt" # file with list of recipe urls

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = "credentials.json"

bucket_name = gcloud_project_id() + ".appspot.com" # the bucket we want to store the media in

# Use the application default credentials
cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {
	'projectId': gcloud_project_id(),
})

db = firestore.client()
bucket = storage.bucket(bucket_name)

def get_recipes_list():
	file = open(recipe_urls_text_file, "r")
	lines = file.readlines()
	file.close()
	return lines

def mark_recipe(recipe): # if we successfully upload a recipe to firestore, mark it with a + at the start of the line. This way we know it worked and
	file = open(recipe_urls_text_file, "r+") # can skip it if the program is run again
	lines = file.readlines()

	for lineIndex in range(0, len(lines)):
		if recipe in lines[lineIndex]:
			lines[lineIndex] = "+" + lines[lineIndex]

	file.seek(0)
	file.writelines(lines)
	file.close()

def get_recipe(url): # Postman suggested I use this format for my request so I did. Seems to wrok
	payload = {}
	headers = {
		'Cookie': 'crumb=BcrNG+mb1uorZjU1N2Q4ZWMzZDRhZmM1ZjY1ZDhmNDAxNDBhNTJi' 
	}

	response = requests.request("GET", url, headers=headers, data = payload)

	html = response.text # get the html

	parsed_html = BeautifulSoup(html, features='html5lib') # have beautiful soup parse it

	if parsed_html == None: # If it fails, break out
		print("Failed at: " + url)
		return

	image_url = parsed_html.find('div', class_="banner-image content-fill").find("img")['data-src'] # Banner image

	# if image_url == '' or image_url == None: # Debugging
	# 	print("Couldn't find image.")

	if parsed_html.find('div', class_="sqs-video-wrapper") != None: # used to get the url to the youtube video
		video_url = parsed_html.find('div', class_='sqs-video-wrapper')['data-html'].split("src=\"")[1].split("\"")[0]

		if "youtube" not in video_url and "youtu.be" not in video_url: # if youtube isn't in the url, we don't care about it
			video_url = ""
		else:
			video_url = video_url.split("www.")[1]
			if "?" in video_url:
				video_url = video_url.split("?")[0]

			video_url = video_url.replace('/embed/', '/watch?v=')
	elif parsed_html.find('a', class_="sqs-block-image-link") != None:
		video_url = parsed_html.find('a', class_="sqs-block-image-link")['href'].strip()
	else: # if neither of the above worked, then its in a format I haven't looked at yet
		video_url = ""

	preparations_data = { }
	ingredients_data = { }
	
	# Gathers all of the preparation data
	if "p" == parsed_html.find('h1', attrs= { "style": "margin-left:40px;white-space:pre-wrap;" }).next.next.name: # if multiple preparations_
		cursor = parsed_html.find('h1', attrs= { "style": "margin-left:40px;white-space:pre-wrap;" }).next.next.next.next.next

		while cursor:
			preparation_name = cursor.previous.replace(':', '')
			preparation_list = []

			preparation = cursor.find_all("li")
			for m in preparation:
				preparation_list.append(m.find("p").text)
			
			preparations_data[preparation_name] = preparation_list
			cursor = cursor.findNext('ol')

	elif "ol" == parsed_html.find('h1', attrs= { "style": "margin-left:40px;white-space:pre-wrap;" }).next.next.name: # if only a single preparation
		preparation_list = []
		preparation = parsed_html.find('h1', attrs= { "style": "margin-left:40px;white-space:pre-wrap;" }).next.next.find_all("li")
		for m in preparation:
			preparation_list.append(m.find("p").text)

		preparations_data['preparation'] = preparation_list

	# Gathers all of the ingredients data
	if "p" == parsed_html.find('h3', attrs= { "style": "margin-left:40px;white-space:pre-wrap;" }).next.next.name: # if multiple ingredient lists
		cursor = parsed_html.find('h3', attrs= { "style": "margin-left:40px;white-space:pre-wrap;" }).next.next.next.next.next

		while cursor:
			preparation_name = cursor.previous.replace(':', '')
			ingredients_list = []

			ingredients = cursor.find_all("li")
			for i in ingredients:
				ingredients_list.append(i.find("p").text)
			
			ingredients_data[preparation_name] = ingredients_list
			cursor = cursor.findNext('ul')

	elif "ul" == parsed_html.find('h3', attrs= { "style": "margin-left:40px;white-space:pre-wrap;" }).next.next.name: # if only a single ingredient list
		ingredients_list = []
		preparation_name = parsed_html.find('h3', attrs= { "style": "margin-left:40px;white-space:pre-wrap;" }).next.next.find_all("li")
		for m in preparation:
			ingredients_list.append(m.find("p").text)

		ingredients_data['ingredients'] = ingredients_list

	image_path = downloadImage(image_url) # locally download the image
	original_public_url = uploadToBucket(image_path, "original/") # put the original in a bucket
	image_path = cropImage(image_path) # crop the local image
	cropped_public_url = uploadToBucket(image_path, "cropped/") # put the cropped image in a bucket
	os.remove(image_path) # delete the local image
 
	recipe_data = { # create a payload for firestore
		"title": parsed_html.find('h1', class_="page-title").text.strip(),
		"description": parsed_html.find('div', class_="entry-content").find('h2').text.strip(),
		"image": original_public_url,
		"cropped_image": cropped_public_url,
		"date": datetime.datetime.strptime(parsed_html.find('time', class_='published').text.strip() + ": 6:00PM", '%B %d, %Y: %I:%M%p'), # I set it to 6pm because if I don't it can mess with the dates. Don't know why
		"video": video_url,
		"url": url,
		"multiple_ingredients": True if "preparation" not in preparations_data.keys() else False,
		"multiple_preparations": True if "ingredients" not in ingredients_data.keys() else False
	}

	doc_ref = db.collection('recipes').document() # create a new document reference
	doc_ref.set(recipe_data) # put the payload into the document

	# puts the preparation data into document(s) in the preparations subcollection
	if "preparation" in preparations_data.keys(): # if only one preparation
		preparation_data = {}
		for mi in range(0, len(preparations_data['preparation'])):
			preparation_data[str(mi)] = preparations_data['preparation'][mi]
		db.collection('recipes').document(doc_ref.id).collection("preparations").document("preparation").set(preparation_data)
	else: # if multiple preparations
		for key in preparations_data.keys():
			preparation_data = {}
			for mi in range(0, len(preparations_data[key])):
				preparation_data[str(mi)] = preparations_data[key][mi]
			db.collection('recipes').document(doc_ref.id).collection("preparations").document(key.replace('/', '\\')).set(preparation_data)

	# puts the ingredients data into document(s) in the ingredients subcollection
	if "ingredients" in ingredients_data.keys(): # if only one ingredient list
		preparation_data = {}
		for ii in range(0, len(ingredients_data['ingredients'])):
			preparation_data[str(ii)] = ingredients_data['ingredients'][ii]
		db.collection('recipes').document(doc_ref.id).collection("ingredients").document("ingredients").set(preparation_data)
	else: # if multiple ingredient lists
		for key in ingredients_data.keys():
			preparation_data = {}
			for ii in range(0, len(ingredients_data[key])):
				preparation_data[str(ii)] = ingredients_data[key][ii]
			db.collection('recipes').document(doc_ref.id).collection("ingredients").document(key.replace('/', '\\')).set(preparation_data)

def downloadImage(url): # downloads a local image
	img_data = requests.get(url, stream=True)
	filename = str(uuid.uuid4()) + "." + url.split("?")[0].split(".")[-1]
	with open(filename, 'wb') as handle:
		if not img_data.ok:
			print("Bad image data?")
		for block in img_data.iter_content(1024):
			if not block:
				break
			handle.write(block)
	return filename

def cropImage(filename): # crops an image to square format works for portrait and landscape
	original = Image.open(filename)
	width, height = original.size

	v_offset = 0
	h_offset = 0
	if width < height:
		v_offset = (height - width) / 2
		height = width
	elif height < width:
		h_offset = (width - height) / 2
		width = height

	cropped_image = original.crop((h_offset, v_offset, width + h_offset, height + v_offset))
	cropped_image.save(filename)
	del cropped_image # garbage collection
	del original # garbage collection

	return filename

def uploadToBucket(filename, path_modifier=""): # puts something in the bucket (images only for now)
	blob = bucket.blob("media/" + path_modifier + filename)
	with open(filename, 'rb') as file:
		blob.upload_from_file(file)
	return blob.public_url

if __name__ == "__main__":
	for recipe in get_recipes_list(): # iterate through all recipes in the file
		recipe_url = recipe.strip() # strip the lines
		if recipe_url[0] != 'h': # if the start of the line isn't https:... ignore (means we've already processed the recipe or marked it as bad)
			print("Ignoring Recipe: %s" % recipe_url[1:])
		else: # process the recipe
			get_recipe(recipe_url)
			print("Got recipe: %s" % recipe_url)
			mark_recipe(recipe_url)
			time.sleep(5) # not necessary but sometimes squarespace becomes aware of our antics and this lets the script process more recipes before error and having to restart
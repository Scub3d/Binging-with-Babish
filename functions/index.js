const {
		dialogflow,
		BasicCard,
		Button,
		Image,
		Suggestions,
		LinkOutSuggestion,
		Table,
		List,
		Carousel,
} = require('actions-on-google');

const functions = require('firebase-functions');
const app = dialogflow({debug: true});
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

var binging_recipes = db.collection('recipes');
 
process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

binging_with_babish_base_url = "https://bingingwithbabish.com"

app.intent('Recipes', (conv) => { // Is called when a user asks for recipes or recent recipes, etc.
	if (!conv.screen) { // I don't feel like making this work for audio
		return conv.ask('Sorry, try this on a screened device or in the simulator.');
	} else if(!conv.surface.capabilities.has('actions.capability.WEB_BROWSER')) { // Not phone
		return db.collection('recipes').orderBy('date', 'desc').limit(10).get().then(recipes => { // Get the x latest recipes from the firestore
			recipes_data = {}

			recipes.forEach(recipe => { // Iterate through each document to get the data we need
				recipes_data[recipe.id] = { // Add a list element to our ... list
					title: recipe.data().title,
					description: recipe.data().date.toDate().toDateString(),
					synonyms: recipe.data().synonyms,
					image: new Image({
						url: recipe.data().image,
						alt: recipe.data().image_alt
					})
				};
			});

			conv.ask('Here of some of the recent recipes');			
			conv.ask(new Carousel({ // Display the list elements as a carousel
				title: 'Recent Recipes',
				items: recipes_data,
			}));

			conv.ask(new Suggestions(['Random recipe']));

			create_linkout_suggestion_chip_to_website(conv, binging_with_babish_base_url); // See function declaration

			return conv.contexts.set('specific_recipe', 1); // Set a context called specific_recipewith a lifetime of one. Let's the app know where . The name is not important
		}).catch(error => { // Happens if it can't find anything or something
			return conv.ask('Something went wrong. Please try again.');
		});
	} else { // Phone
		return db.collection('recipes').orderBy('date', 'desc').limit(10).get().then(recipes => { // Get the x latest recipes from the firestore
			recipes_data = {}

			recipes.forEach(recipe => { // Iterate through each document to get the data we need
				recipes_data[recipe.id] = { // Add a list element to our ... list
					title: recipe.data().title,
					description: recipe.data().date.toDate().toDateString(),
					synonyms: recipe.data().synonyms,
					image: new Image({
						url: recipe.data().cropped_image, // I use the recipe image here, but if you had an image for each "sub-recipe" then it could be replaced with that
						alt: recipe.data().image_alt // Ditto
					})
				};
			});
			
			conv.ask('<speak>Here of some of the recent recipes</speak>');		

			conv.ask(new List({ // Display the list elements as a list
				title: 'Recent Recipes',
				items: recipes_data,
			}));

			conv.ask(new Suggestions(['Random recipe']));

			create_linkout_suggestion_chip_to_website(conv, binging_with_babish_base_url); // See function declaration

			return conv.contexts.set('specific_recipe', 1); // Set a context called specific_recipe with a lifetime of one. Let's the app know where it is rn. The name is not important
		}).catch(error => { // Happens if it can't find anything or something
			return conv.ask('Something went wrong. Please try again.');
		});
	}	
});

app.intent('Recipe', (conv, params) => { // When the user asks for a specific recipe
	if (!conv.screen) { // I don't feel like making this work for audio
		return conv.ask('Sorry, try this on a screened device or in the simulator.');
	}

	recipe_context = conv.contexts.get("recipe"); // Get context so we can get the recipe id

	if(params.recipes !== null && params.recipes !== "" && params.recipes !== " " && params.recipes !== undefined) { // Happens if the user directly asks for a recipe
		return db.collection('recipes').where('title', '=', params.recipes).limit(1).get().then(snapshot => { // If we find a title that matches, get it and display it
			return display_recipe(conv, snapshot.docs[0]); 
		}).catch(err => { // Should only happen if somehow the recipes entity has an entry that isn't in the db. Which can't happen
			console.log('Error getting documents', err); // This shouldn't really happen but if it does it's nice to know how it happened
			return conv.ask('Something went wrong. Please try again.');
		});
	} else if(recipe_context !== null && recipe_context !== undefined) { // Happens if the user goes back to the recipe via a suggestion chip (from ingredients or preparations screen)
		return db.collection('recipes').doc(recipe_context.parameters["recipe_id"]).get().then(recipe => { // get the recipe who's id is stored in the context
			return display_recipe(conv, recipe);
		}).catch(error => {
			return conv.ask('Something went wrong. Please try again.'); // Happens if the recipe id stored in the context gets bungled
		});
	} else{
		return conv.ask("Recipe. Shouldn't happen"); // This really shouldn't happen		
	}	
});

// Don't have to worry about non-screened devices for option intents
app.intent('Recipe - OPTION', (conv, params, option) => { // When the user selects a recipe from a list/carousel
	if(option !== null && option !== undefined) { // Double check to make sure the user actually did select an item
		return db.collection('recipes').doc(option).get().then(recipe => { // option is the recipe id
			return display_recipe(conv, recipe);
		}).catch(error => {
			return conv.ask('Something went wrong. Please try again.');
		});
	} else { // Really, this should not happen
		return conv.ask("Recipe - OPTION. Shouldn't happen");
	}
});

app.intent('Random Recipe', (conv, params, option) => { // When the user asks for a random recipe
	if (!conv.screen) { // I don't feel like making this work for audio
		return conv.ask('Sorry, try this on a screened device or in the simulator.');
	}

	var generatedId = db.collection('recipes').doc().id; // generate a random id

	return db.collection('recipes').where(admin.firestore.FieldPath.documentId(), '>=', generatedId).limit(1).get().then(recipes => { // check to see if there is an id greater than or equal to our generated id
		if(recipes.size > 0) { // If there is, display that recipe
			return display_recipe(conv, recipes.docs[0]);
		} else { // If there isn't, try less than (this should always work)
			return db.collection('recipes').where(admin.firestore.FieldPath.documentId(), '<', generatedId).limit(1).get().then(recipes => {
				return display_recipe(conv, recipes.docs[0]);
			}).catch(err => {
				console.log('Error getting documents', err); // This shouldn't really happen but if it does it's nice to know how it happened
				return conv.ask("There was an error getting a random recipe. Please try again.");
			});
		}
	}).catch(err => {
		console.log('Error getting documents', err); // This shouldn't really happen but if it does it's nice to know how it happened
		return conv.ask("Something went wrong. Please try again.");
	});
});

app.intent('Preparations', (conv, params) => { // When the user 
	if (!conv.screen) { // I don't feel like making this work for audio
		return conv.ask('Sorry, try this on a screened device or in the simulator.');
	}

	recipe_context = conv.contexts.get("recipe"); // Get context so we can get the recipe id

	if (recipe_context === null) { // We can't help if we don't know what recipe the user wants info for
		return conv.ask("Please first select a recipe.") 
	}

	return db.collection('recipes').doc(recipe_context.parameters["recipe_id"]).get().then(recipe => {// get recipe document
		return db.collection('recipes').doc(recipe_context.parameters["recipe_id"]).collection("preparations").get().then(preparations => { // get preparation documents
			preparations_data = {};

			preparations.forEach(preparation => { // Iterate through all of it's preparations and get the titlle (stored as it's id)
				preparations_data[preparation.id] = {
					title: preparation.id,
				};
			});

			if(Object.keys(preparations_data).length === 1) { // If we only have one result, then we can just display the resulting info
				return display_preparations_table(conv, recipe, preparations.docs[0], false); 
			} else if(Object.keys(preparations_data).length > 1) { // If we have multiple ways to prepare the recipe, ask the user to select one
				conv.ask('<speak>Please select how you want to prepare it</speak>');

				conv.ask(new List({
					title: "How would you like to prepare " + recipe.data().title,
					items: preparations_data,
				}));

				conv.ask(new Suggestions(['Ingredients', 'Back to recipe']));
				
				create_linkout_suggestion_chip_to_website(conv, recipe.data().url); // See function declaration

				conv.contexts.set('recipe', 1, {'recipe_id': recipe.id}); // Set a context called recipe with the value of our recipe id. Give it a lifetime of one.

				return conv.contexts.set('specific_preparations', 1); // Set a context called specific_preparationswith a lifetime of one. Let's the app know where . The name is not important
			} else {
				return conv.ask('This should not occur'); // This really shouldn't happen
			}
		});
	});
});

 // Don't have to worry about non-screened devices for option intents
app.intent('Preparations - OPTION', (conv, params, option) => { // When the user selects a preparation from a list/carousel
	recipe_context = conv.contexts.get("recipe"); // Get context so we can get the recipe id

	return db.collection('recipes').doc(recipe_context.parameters["recipe_id"]).get().then(recipe => { // get recipe document
		return db.collection('recipes').doc(recipe_context.parameters["recipe_id"]).collection("preparations").doc(option).get().then(preparation => { // get specific preparation document
			return display_preparations_table(conv, recipe, preparation, recipe.data().multiple_preparations); // display 
		});
	});
});

app.intent("Ingredients", (conv, params) => {
	if (!conv.screen) { // I don't feel like making this work for audio
		return conv.ask('Sorry, try this on a screened device or in the simulator.');
	}

	recipe_context = conv.contexts.get("recipe"); // Get context so we can get the recipe id

	if (recipe_context === null) {
		return conv.ask("Please first select a recipe.")
	}

	return db.collection('recipes').doc(recipe_context.parameters["recipe_id"]).get().then(recipe => { // get recipe document
		return db.collection('recipes').doc(recipe_context.parameters["recipe_id"]).collection("ingredients").get().then(ingredients => { // get ingredient documents
			ingredients_data = {};

			ingredients.forEach(ingredient => { // Iterate through each ingredient list document and get the id (title) so we can display if we need to
				ingredients_data[ingredient.id] = { // Even though I use ingredient here, it is actually a list of ingredients. I just wanted it to match preparations' code
					title: ingredient.id,
				};
			});

			if(Object.keys(ingredients_data).length === 1) { // If we only have one result, then we can just display the resulting info
				return display_ingredients_table(conv, recipe, ingredients.docs[0], false);
			} else if(Object.keys(ingredients_data).length > 1) { // If we have multiple ingredient lists for the recipe, ask the user to select one
				conv.ask('<speak>Please select a which part of the recipe you want ingredients for</speak>'); // Could be worded better
				conv.ask(new List({
					title: recipe.data().title + " Ingredients",
					items: ingredients_data,
				}));

				conv.ask(new Suggestions(['How to prepare', 'Back to recipe']));

				create_linkout_suggestion_chip_to_website(conv, recipe.data().url); // See function declaration
				
				conv.contexts.set('recipe', 1, {'recipe_id': recipe.id}); // Set a context called recipe with the value of our recipe id. Give it a lifetime of one.
				
				return conv.contexts.set('specific_ingredients', 1); // Set a context called specific_ingredients with a lifetime of one. Let's the app know where . The name is not important
			} else {
				return conv.ask('This should not have occurred'); // I cannot not stress this enough but... this should not happen
			}
		});
	});
});

// Don't have to worry about non-screened devices for option intents
app.intent('Ingredients - OPTION', (conv, params, option) => { // When the user selects an ingredient list from a list/carousel
	recipe_context = conv.contexts.get("recipe"); // Get context so we can get the recipe id

	return db.collection('recipes').doc(recipe_context.parameters["recipe_id"]).get().then(recipe => { // get recipe document
		return db.collection('recipes').doc(recipe_context.parameters["recipe_id"]).collection("ingredients").doc(option).get().then(ingredients => { // get specific ingredient list document
			return display_ingredients_table(conv, recipe, ingredients, recipe.data().multiple_ingredients); // display
		});
	});
});

function display_recipe(conv, recipe) { // Display the recipe
	conv.ask('<speak>' + recipe.data().title + '</speak>'); // speak

	conv.ask(new BasicCard({ 
		title: recipe.data().title,
		subtitle: recipe.data().date.toDate().toDateString(),
		text: recipe.data().description,
		buttons: new Button({
			title: 'Watch on YouTube',
			url: recipe.data().video
		}),
		image: new Image({
			url: recipe.data().cropped_image,
			alt: recipe.data().image_alt
		}),
		display: 'CROPPED',
	}));

	conv.ask(new Suggestions(['Ingredients', 'How to prepare'])); // Some handy suggestions

	create_linkout_suggestion_chip_to_website(conv, recipe.data().url); // See function declaration

	conv.contexts.set('recipe', 1, {'recipe_id': recipe.id}); // Set a context called recipe with the value of our recipe id. Give it a lifetime of one.
}

function display_ingredients_table(conv, recipe, ingredients, has_more_ingredients) {
	row_data = []

	Object.keys(ingredients.data()).forEach(key => { // Put all of the ingredients data into a format which we can stuff into the table
		row_data.push({
			cells: [ingredients.data()[key]],
			dividerAfter: false
		})
	});
	
	conv.ask('<speak> Ingredient list for ' + ingredients.id + '</speak>'); // spoken

	display_table(conv, recipe, ingredients.id, 'Ingredients', row_data); // display table

	conv.ask(new Suggestions(['How to prepare', 'Back to recipe'])); // Some handy suggestions

	if(has_more_ingredients) { // If the recipe has multiple ways to ingredient lists, give the user an easy way to go back
		conv.ask(new Suggestions(['More Ingredients']));
	}

	create_linkout_suggestion_chip_to_website(conv, recipe.data().url); // See function declaration

	conv.contexts.set('recipe', 1, {'recipe_id': recipe.id}); // Set a context called recipe with the value of our recipe id. Give it a lifetime of one.
}

function display_preparations_table(conv, recipe, preparation, has_more_preparations) {
	row_data = []

	Object.keys(preparation.data()).forEach(key => { // Put all of the preparations data into a format which we can stuff into the table
		row_data.push({ 
			cells: [preparation.data()[key]],
			dividerAfter: false
		})
	});
	
	conv.ask('<speak>How to prepare ' + preparation.id + '</speak>'); // spoked

	display_table(conv, recipe, preparation.id, 'Steps', row_data); // display table

	conv.ask(new Suggestions(['Ingredients', 'Back to recipe'])); // Some handy suggestions

	if(has_more_preparations) { // If the recipe has multiple ways to prepare it, give the user an easy way to go back
		conv.ask(new Suggestions(['More ways to prepare']));
	}
	
	create_linkout_suggestion_chip_to_website(conv, recipe.data().url); // See function declaration
	 
	conv.contexts.set('recipe', 1, {'recipe_id': recipe.id}); // Set a context called recipe with the value of our recipe id. Give it a lifetime of one.
}

function display_table(conv, recipe, subtitle, header, row_data) {
	conv.ask(new Table({
		title: recipe.data().title,
		subtitle: subtitle,
		image: new Image({
			url: recipe.data().cropped_image, // I use the recipe image here, but if you had an image for each "sub-recipe" then it could be replaced with that
			alt: recipe.data().image_alt, // Ditto
		}),
		columns: [
			{
				header: header,
				align: 'LEADING',
			}
		],

		rows: row_data, // <-- The goods
	}));
}

// These won't display because I haven't shown google that I own the domain it links to (bingingwithbabish.com/*)
// https://developers.google.com/assistant/conversational/df-asdk/reference/webhook/rest/Shared.Types/AppResponse#linkoutsuggestion
// This will let the user goto the webpage for the recipe
function create_linkout_suggestion_chip_to_website(conv, url) {
	conv.ask(new LinkOutSuggestion({
		destinationName: 'website', // This will make the chip say: "Open website"
		openUrlAction: {
			url: url
		}
	}));
}

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app); // Don't touch
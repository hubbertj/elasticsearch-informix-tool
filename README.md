# elasticsearch-hoss-Tool
Creates, updates a elasticsearch index.
Process:
	Pulls all records from the informix data defined in your properties file.
	Depending on your arguments, it will either create or update a index.
	Pulls from the output/FilterDataList.json and makes the correct rest call to the elk server.

## Installation
install node & npm

$> npm install
$> node elasticsearchHossTool

	$> elasticsearchHossTool --help
	Usage: elasticsearchHossTool [options] <file>

  Options:

  -f, --force  <indexName>  Use if you want to specify the index. And want to skip the data gather process.
  -c, --create <indexName>  When used this will create a new index and insert the new documents
  -u, --update <indexName>  When used this will try to update the index and insert the new documents.
  -h, --help                output usage information


## How to use the elasticsearch-hoss-tool
    
    $> node elasticsearchHossTool -c searchable
    This will pull json from the database, then create a index called searchable
    Then inject documents from the json file into your new index "searchable".
  
## Notes
All configuration are located in the config/application.properties file
When the applicaiton runs the hoss_data_ingress.jar it creates a output folder with FilterDataList.json and RawDataList.json
RawDataList.json is before the merge is applied.

If you have a issue with herp size you make need to run node like this
$> node --max-old-space-size=4096 elasticsearchHossTool --create <indexName> 


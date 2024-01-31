//https://www.electron.build/configuration/configuration#afterpack

const rootPath = path.join('./')
const buildPath = path.join(rootPath, 'release-builds')

exports.default = async function(context) {   
    //console.log(context)
    var fs = require('fs');     
    var localeDir = path.join(buildPath, 'rlocales');
  
    fs.readdir(localeDir, function(err, files){         
        //files is array of
        filenames (basename form)         
        if(!(files && files.length)) return;        
        for(var i = 0, len = files.length; i < len; i++) {           
            var match = files[i].match(/en-US\.pak/);             
            if(match === null){
                fs.unlinkSync(localeDir+files[i]);          
            }       
        }   
    }); 
} 
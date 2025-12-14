
import ee

def preprocess_s2(start: str, end: str, aoi: ee.Geometry, ci_type: str):
    col = ee.ImageCollection('COPERNICUS/S2_SR').filterBounds(aoi).filterDate(start, end)
    col = col.map(lambda img: img.updateMask(img.select('QA60').eq(0)))
    col = col.map(lambda img: add_ci(img, ci_type))
    return col

def add_ci(img: ee.Image, ci_type: str):
    if ci_type == "rededge":
        ci = img.expression('(nir / re) - 1', {'nir': img.select('B8'), 're': img.select('B5')}).rename('CI')
    else:
        ci = img.expression('(nir / green) - 1', {'nir': img.select('B8'), 'green': img.select('B3')}).rename('CI')
    return img.addBands(ci)

def ci_composite(col: ee.ImageCollection):
       comp = col.median()

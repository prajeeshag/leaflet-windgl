import numpy as np

nparticles = 16
ntails = 8
npoints = nparticles * ntails

pointIndexes = np.arange(npoints)
print(np.floor(pointIndexes / ntails))
print(((1.0 - (pointIndexes + 1) % ntails) == 1).astype(int))

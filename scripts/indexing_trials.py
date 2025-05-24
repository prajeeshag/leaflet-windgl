import numpy as np

nparticles = 16
ntails = 8
npoints = nparticles * ntails

pointIndexes = np.arange(npoints)
p_index = np.floor(pointIndexes / ntails)
print(p_index)
for i in range(ntails):
    print(f"Tail {i}")
    print((pointIndexes + ntails - i) % ntails)

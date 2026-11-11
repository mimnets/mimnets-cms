# Sourced by pbmc and assurer-pbm-agent (m1-068): PBM's connection to the mongo
# service, with the pbm user's password from the read-only /secrets volume
# (pbm-secrets). It goes through the environment, not the arguments.
PBM_MONGODB_URI="mongodb://pbm:$(cat /secrets/mongo-password)@mongo:27017/?authSource=admin&replicaSet=rs0&tls=true&tlsCAFile=/secrets/ca.pem"
export PBM_MONGODB_URI

# Sourced by assurer-app and assurer-task (m1-068): the app's database address
# and session secret, from the read-only /secrets volume (app-secrets). They
# go through the environment, not the arguments.
APOS_DB_URI="mongodb://assurerApp:$(cat /secrets/mongo-password)@mongo:27017/assurer?replicaSet=rs0&authSource=assurer&tls=true&tlsCAFile=/secrets/ca.pem"
APOS_SESSION_SECRET="$(cat /secrets/session-secret)"
export APOS_DB_URI APOS_SESSION_SECRET

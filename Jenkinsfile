pipeline {
    agent any

    triggers {
        githubPush() 
    }

    stages {
        stage('Checkout Code') {
            steps {
                git branch: 'main', url: 'https://github.com/SurajMandal14/my-bot-app.git'
            }
        }

        stage('Build Podman Image') {
            steps {
                sh 'sudo podman build -t my-bot-app-image .'
            }
        }

        stage('Stop & Remove Old Container') {
            steps {
                sh 'sudo podman stop my-bot-app || true'
                sh 'sudo podman rm my-bot-app || true'
            }
        }

        stage('Deploy New Container') {
            steps {
                // This block securely loads BOTH credentials from Jenkins.
                withCredentials([
                    string(credentialsId: 'mongodb-uri-credential', variable: 'MONGODB_URI_VALUE'),
                    string(credentialsId: 'gemini-api-key-credential', variable: 'GEMINI_API_KEY_VALUE')
                ]) {
                    // We now pass both secrets to the container using two -e flags.
                    sh '''
                        sudo podman run -d --restart=always --name my-bot-app \
                        --network mongo-net -p 3000:3000 \
                        -e MONGODB_URI="${MONGODB_URI_VALUE}" \
                        -e GEMINI_API_KEY="${GEMINI_API_KEY_VALUE}" \
                        my-bot-app-image
                    '''
                }
            }
        }
    }

    post {
        always {
            echo 'Deployment finished. Cleaning up old images...'
            sh 'sudo podman image prune -a -f'
        }
    }
}

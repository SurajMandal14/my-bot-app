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

        // ⚠️ CRITICAL: This stage must be here to prevent name conflicts
        stage('Stop & Remove Old Container') {
            steps {
                sh 'sudo podman stop my-bot-app || true'
                sh 'sudo podman rm my-bot-app || true'
            }
        }

        stage('Deploy New Container') {
            steps {
                withCredentials([
                    string(credentialsId: 'mongodb-uri-credential', variable: 'MONGODB_URI_VALUE'),
                    string(credentialsId: 'gemini-api-key-credential', variable: 'GEMINI_API_KEY_VALUE')
                ]) {
                    // UPDATED: Uses --network host so it can talk to DB on localhost
                    sh '''
                        sudo podman run -d --restart=always --name my-bot-app \
                        --network host \
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
            echo 'Deployment finished. Cleaning up dangling images...'
            // Kept -f but removed -a to speed up future builds
            sh 'sudo podman image prune -f'
        }
    }
}

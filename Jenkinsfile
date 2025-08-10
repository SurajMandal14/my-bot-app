pipeline {
    agent any

    stages {
        stage('Checkout Code') {
            steps {
                // Fetches the latest code from your repository
                git branch: 'main', url: 'https://github.com/SurajMandal14/my-bot-app.git'
            }
        }

        stage('Build Podman Image') {
            steps {
                // Builds the image inside your project directory
                dir('my-bot-app') { // Assumes code is in a subdirectory, adjust if needed
                    sh 'sudo podman build -t my-bot-app-image .'
                }
            }
        }

        stage('Stop & Remove Old Container') {
            steps {
                // Stops and removes the old container. `|| true` prevents failure if it doesn't exist.
                sh 'sudo podman stop my-bot-app || true'
                sh 'sudo podman rm my-bot-app || true'
            }
        }

        stage('Deploy New Container') {
            steps {
                // Runs your new container with the specified settings
                sh 'sudo podman run -d --restart=always --name my-bot-app --network mongo-net -p 3000:3000 my-bot-app-image'
            }
        }
    }

    post {
        always {
            // This block runs after the pipeline finishes
            echo 'Deployment finished. Cleaning up old images...'
            sh 'sudo podman image prune -a -f'
        }
    }
}

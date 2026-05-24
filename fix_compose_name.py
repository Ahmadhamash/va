with open('docker-compose.prod.yml', 'r') as f:
    content = f.read()

if not content.startswith('name: va'):
    with open('docker-compose.prod.yml', 'w') as f:
        f.write('name: va\n' + content)
        print("Added name: va to docker-compose")
else:
    print("Already has name: va")

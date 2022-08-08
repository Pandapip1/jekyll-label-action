# jekyll-label-action

Automatically adds labels depending on what files are modified in a pull request.

## Usage

This action is meant to be used as a standalone workflow:

```yml
# File name: jekyll-label-action.yml
on:
  pull_request_target:

jobs:
  jekyll-label-action:
    name: Automatic Label Bot
    runs-on: ubuntu-latest
    
    steps:
      - uses: Pandapip1/jekyll-label-action@bfc2f4c2e738017a20b4822c229f02d1db79c59b
        with:
          token: ${{ secrets.GITHUB_TOKEN }}  # Valid GitHub token
          config-path: .jekyll-labels.yml          # Path to config file
```

## Configuration

This action uses a configuration file (default: `.jekyll-labels.yml`). The format is simple:

```yml
label-to-apply: this?.new?.property == 'value'
"other-label-to-apply-that-requires-quotes": this?.old?.property2 == 'value2'
```

- `this.old` refers to the parsed front matter of the pre-existing file in the repository that is changed or removed in the Pull Request.
- `this.new` refers to the parsed front matter of the new file that is changed or added in the Pull Request.

See [ethereum/EIPs](https://github.com/ethereum/EIPs/blob/0ace24395ba9dfebed8ac8ed52228e579610c9f9/.jekyll-labels.yml) for a proper example.

# create-ts-monorepo

A CLI tool to initialize a TypeScript monorepo based on the open-source project [ts-monorepo](https://github.com/d-mozulyov/ts-monorepo). Both repositories were created by [Dmitry Mozulyov](https://github.com/d-mozulyov).

## Usage

```bash
npx create-ts-monorepo <directory> [options]
```

### Arguments

- `directory`: Name or path of the directory to create the monorepo in (required).

### Options

- `--help`: Show help information.
- `--skip-example`: Remove the example app from the monorepo.
- `--skip-git`: Skip Git initialization and initial commit.
- `--skip-setup`: Skip running the setup script.
- `--force`: Overwrite the existing directory if it exists.

## License

MIT

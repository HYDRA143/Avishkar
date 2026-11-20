#include <openssl/evp.h>
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
    FILE *input;
    EVP_MD_CTX *context;
    unsigned char buffer[4096];
    unsigned char digest[EVP_MAX_MD_SIZE];
    unsigned int digest_length = 0;
    size_t count;
    int result = EXIT_FAILURE;

    if (argc != 2) {
        return EXIT_FAILURE;
    }
    input = fopen(argv[1], "rb");
    if (input == NULL) {
        return EXIT_FAILURE;
    }
    context = EVP_MD_CTX_new();
    if (context == NULL || EVP_DigestInit_ex(context, EVP_sha256(), NULL) != 1) {
        fclose(input);
        EVP_MD_CTX_free(context);
        return EXIT_FAILURE;
    }
    while ((count = fread(buffer, 1, sizeof(buffer), input)) > 0) {
        if (EVP_DigestUpdate(context, buffer, count) != 1) {
            fclose(input);
            EVP_MD_CTX_free(context);
            return EXIT_FAILURE;
        }
    }
    if (ferror(input)
        || EVP_DigestFinal_ex(context, digest, &digest_length) != 1) {
        fclose(input);
        EVP_MD_CTX_free(context);
        return EXIT_FAILURE;
    }
    for (unsigned int index = 0; index < digest_length; ++index) {
        static const char digits[] = "0123456789abcdef";
        fputc(digits[digest[index] >> 4], stdout);
        fputc(digits[digest[index] & 0x0f], stdout);
    }
    fputc('\n', stdout);
    result = ferror(stdout) ? EXIT_FAILURE : EXIT_SUCCESS;
    fclose(input);
    EVP_MD_CTX_free(context);
    return result;
}

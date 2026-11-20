#include <openssl/evp.h>
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    EVP_MD_CTX *context = EVP_MD_CTX_new();
    unsigned char *input = NULL;
    size_t length = 0;
    size_t capacity = 4096;
    unsigned char digest[EVP_MAX_MD_SIZE];
    unsigned int digest_length = 0;
    int result = EXIT_FAILURE;

    if (context == NULL) {
        return EXIT_FAILURE;
    }
    input = malloc(capacity);
    if (input == NULL) {
        EVP_MD_CTX_free(context);
        return EXIT_FAILURE;
    }
    while (!feof(stdin)) {
        if (length == capacity) {
            unsigned char *expanded;
            capacity *= 2;
            expanded = realloc(input, capacity);
            if (expanded == NULL) {
                free(input);
                EVP_MD_CTX_free(context);
                return EXIT_FAILURE;
            }
            input = expanded;
        }
        length += fread(input + length, 1, capacity - length, stdin);
        if (ferror(stdin)) {
            free(input);
            EVP_MD_CTX_free(context);
            return EXIT_FAILURE;
        }
    }
    if (EVP_DigestInit_ex(context, EVP_sha256(), NULL) != 1
        || EVP_DigestUpdate(context, input, length) != 1
        || EVP_DigestFinal_ex(context, digest, &digest_length) != 1) {
        free(input);
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
    free(input);
    EVP_MD_CTX_free(context);
    return result;
}

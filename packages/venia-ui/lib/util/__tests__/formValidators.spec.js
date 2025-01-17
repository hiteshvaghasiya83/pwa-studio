import * as validators from '../formValidators';

describe('hasLengthAtLeast', () => {
    test('it returns undefined on success', () => {
        const result = validators.hasLengthAtLeast('test', [], 1);

        expect(result).toBeUndefined();
    });

    test('it returns an object on failure', () => {
        const result = validators.hasLengthAtLeast('test', [], 10);

        expect(typeof result).toBe('object');
    });
});

describe('hasLengthAtMost', () => {
    test('it returns undefined on success', () => {
        const result = validators.hasLengthAtMost('test', [], 10);

        expect(result).toBeUndefined();
    });

    test('it returns an object on failure', () => {
        const result = validators.hasLengthAtMost('test', [], 1);

        expect(typeof result).toBe('object');
    });
});

describe('hasLengthExactly', () => {
    test('it returns undefined on success', () => {
        const result = validators.hasLengthExactly('test', [], 4);

        expect(result).toBeUndefined();
    });

    test('it returns an object on failure', () => {
        const result = validators.hasLengthExactly('test', [], 1);

        expect(typeof result).toBe('object');
    });
});

describe('isRequired', () => {
    test('it returns undefined for a valid string', () => {
        const result = validators.isRequired('test');

        expect(result).toBeUndefined();
    });

    test('it returns undefined for a valid boolean', () => {
        const result = validators.isRequired(true);

        expect(result).toBeUndefined();
    });

    test('it returns undefined for a valid number', () => {
        const result = validators.isRequired(42);

        expect(result).toBeUndefined();
    });

    test('it returns an object for an invalid string', () => {
        const result = validators.isRequired('');

        expect(typeof result).toBe('object');
    });

    test('it returns an object for an invalid string (whitespace only)', () => {
        const result = validators.isRequired(' ');

        expect(typeof result).toBe('object');
    });

    test('it returns an object for an invalid boolean', () => {
        const result = validators.isRequired(false);

        expect(typeof result).toBe('object');
    });

    test('it returns an object for undefined input', () => {
        const result = validators.isRequired();

        expect(typeof result).toBe('object');
    });
});

describe('mustBeChecked', () => {
    test('it returns undefined on success', () => {
        const result = validators.mustBeChecked(true);

        expect(result).toBeUndefined();
    });

    test('it returns an object on failure', () => {
        const result = validators.mustBeChecked(false);

        expect(typeof result).toBe('object');
    });

    test('it returns an object on undefined input', () => {
        const result = validators.mustBeChecked();

        expect(typeof result).toBe('object');
    });
});

describe('validateRegionCode', () => {
    const countries = [
        {
            id: 'US',
            available_regions: [
                {
                    id: '1',
                    code: 'AL',
                    name: 'Alabama'
                }
            ]
        },
        { id: 'UA' },
        { id: 'UK' }
    ];

    test('it returns undefined on success', () => {
        const result = validators.validateRegionCode('AL', [], countries);

        expect(result).toBeUndefined();
    });

    test('it returns an object on failure due to bad state value', () => {
        const result = validators.validateRegionCode(
            'some_string',
            [],
            countries
        );

        expect(typeof result).toBe('object');
    });

    test('it returns an object on failure due to missing country', () => {
        const result = validators.validateRegionCode('AL', [], []);

        expect(typeof result).toBe('object');
    });

    test('it returns an object on failure due to no regions', () => {
        const missingRegions = [...countries];
        missingRegions[0].available_regions = [];

        const result = validators.validateRegionCode(
            'some_string',
            [],
            missingRegions
        );

        expect(typeof result).toBe('object');
    });
});

describe('validatePassword', () => {
    test('it returns undefined on success', () => {
        const result = validators.validatePassword('123qwe_+*');

        expect(result).toBeUndefined();
    });

    test('it returns an object on  failure', () => {
        const result = validators.validatePassword('1111');

        expect(typeof result).toBe('object');
    });
});

describe('isEqualToField', () => {
    test('it returns undefined on success', () => {
        const values = {
            password: 'qwerty12345'
        };
        const password = 'qwerty12345';
        const result = validators.isEqualToField(password, values, 'password');

        expect(result).toBeUndefined();
    });

    test('it returns undefined on success with a password key', () => {
        const values = {
            password_key: 'qwerty12345'
        };
        const password = 'qwerty12345';
        const fieldKey = 'password_key';
        const result = validators.isEqualToField(password, values, fieldKey);

        expect(result).toBeUndefined();
    });

    test('it returns an object on failure', () => {
        const values = {
            password: 'qwertz12345'
        };
        const password = 'qwerty12345';
        const result = validators.isEqualToField(password, values, 'password');

        expect(typeof result).toBe('object');
    });
});

describe('isNotEqualToField', () => {
    test('it returns undefined on success', () => {
        const values = {
            password: 'qwerty12345'
        };
        const password = 'qwertz12345';
        const result = validators.isNotEqualToField(
            password,
            values,
            'password'
        );

        expect(result).toBeUndefined();
    });

    test('it returns undefined on success with a password key', () => {
        const values = {
            password_key: 'qwerty12345'
        };
        const password = 'qwertz12345';
        const fieldKey = 'password_key';
        const result = validators.isNotEqualToField(password, values, fieldKey);

        expect(result).toBeUndefined();
    });

    test('it returns an object on failure', () => {
        const values = {
            password: 'qwerty12345'
        };
        const password = 'qwerty12345';
        const result = validators.isNotEqualToField(
            password,
            values,
            'password'
        );

        expect(typeof result).toBe('object');
    });
});

describe('isValidEmail', () => {
    test.each([
        'simple@example.com',
        'very.common@example.com',
        'disposable.style.email.with+symbol@example.com',
        'other.email-with-hyphen@example.com',
        'fully-qualified-domain@example.com',
        'user.name+tag+sorting@example.com',
        'x@example.com',
        'example-indeed@strange-example.com',
        'test/test@test.com',
        'admin@mailserver1',
        'example@s.example',
        '" "@example.org',
        '"john..doe"@example.org',
        'mailhost!username@example.org',
        'user%example.com@example.org',
        'user-@example.org',
        'i_like_underscore@but_its_not_allowed_in_this_part.example.com'
    ])('it returns undefined on success for %s', emailID => {
        expect(validators.isValidEmail(emailID)).toBeUndefined();
    });

    test.each([
        'Abc.example.com',
        'A@b@c@example.com',
        'a"b(c)d,e:f;g<h>i[jk]l@example.com',
        'just"not"right@example.com',
        'this is"notallowed@example.com',
        'this still"not\\allowed@example.com',
        '1234567890123456789012345678901234567890123456789012345678901234+x@example.com',
        'QA[icon]CHOCOLATE[icon]@test.com'
    ])('it returns an object on failure for %s', emailID => {
        expect(typeof validators.isValidEmail(emailID)).toBe('object');
    });
});

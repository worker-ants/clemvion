-- V152: 이름 변경이 남긴 빈 문자열 webauthn_credential.device_name 을 NULL 로 바꾼다 (data fix)
--
-- 관련 spec:
--   - CLE-ACCT-SIGNIN 「Passkey 등록·인증 흐름」 · Rationale «Passkey 이름 변경은 공백 문자로만 된 이름을 거부한다 (2026-10-17)»
--   - CLE-ACCT-DATA 「WebAuthnCredential」 device_name 행
--   - NERV Task CLE-T-SREW0S
--
-- 배경:
--   Passkey 이름 변경은 공백 문자로만 된 이름을 받아 앞뒤 공백을 지운 빈 문자열로 저장했다. 등록 검증은
--   같은 입력을 NULL 로 저장해서 이름이 없다는 값이 NULL 과 빈 문자열 두 가지로 갈렸다. 목록 화면은
--   NULL 일 때만 기본 문구를 보여 줘서 빈 문자열인 Passkey 는 이름이 빈 칸으로 보였다. 이름 변경은 이제
--   그런 이름을 400 으로 거부하고, 이미 저장된 빈 문자열은 여기서 NULL 로 바꾼다.
--
-- 범위:
--   device_name 이 정확히 빈 문자열인 행만 바꾼다. 두 저장 경로는 처음(V057)부터 앞뒤 공백을 지워
--   저장했으므로 공백 문자만 남은 값은 없다.
--
-- 멱등성:
--   바꾼 행은 NULL 이라 다시 돌려도 대상이 없다.

UPDATE webauthn_credential
SET device_name = NULL
WHERE device_name = '';

-- DOWN: 되돌리지 않는다. 바꾼 뒤에는 원래 빈 문자열이던 행과 원래 NULL 이던 행을 구분할 수 없다.
--   두 값 모두 이름이 없다는 뜻이고 NULL 이면 화면에 기본 문구가 보인다.

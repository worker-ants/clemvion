# 보안(Security) Review

## 발견사항

### 파일 6: spec/conventions/cafe24-api-catalog/_generator.py

- **[INFO]** `entity_id` 기반 캐시 파일 경로에 경로 트래버설 가능성 (이론적)
  - 위치: `fetch_entity_json()` 함수, `cache = os.path.join(cache_dir, entity_id + ".json")` 라인
  - 상세: `entity_id` 는 Cafe24 공식 HTML 파싱으로 추출된 값으로, `../` 같은 경로 트래버설 시퀀스를 포함할 경우 `cache_dir` 범위 밖의 경로에 캐시 파일을 읽거나 쓸 수 있다. 캐시 읽기(`open(cache, "r")`) 및 쓰기(`open(cache, "w")`) 양방에서 동일하게 미검증 경로를 사용한다. 다만 이 스크립트는 (1) 개발자가 직접 실행하는 CLI 도구이며 (2) 입력 HTML 출처가 신뢰된 Cafe24 공식 API 문서이고 (3) 외부 사용자 입력을 받는 서비스가 아니므로 실제 공격 면은 극히 제한적이다.
  - 제안: 방어적 코딩 차원에서 `os.path.basename(entity_id)` 로 경로 구분자를 제거하거나, `os.path.abspath(cache)` 결과가 `os.path.abspath(cache_dir)` 로 시작하는지 검사하는 경계 검증 추가를 권장.

- **[INFO]** `_http_get()` 에서 URL 을 `subprocess.run(["curl", ..., url])` 에 리스트 인자로 전달 — 셸 인젝션 위험 없음
  - 위치: `_http_get()` 함수
  - 상세: `subprocess.run` 호출 시 리스트 형식으로 인자를 전달하고 있어 셸 인젝션이 발생하지 않는다(올바른 구현). 이번 diff 의 직접 변경 범위는 아니나 리뷰 완료 기록 차원에서 명시.

### 파일 4: codebase/frontend/src/lib/i18n/backend-labels.ts

- **[INFO]** 신규 에러 코드 한국어 메시지가 내부 시스템 정보를 포함하지 않음 — 정보 노출 없음
  - 위치: `ERROR_KO` 테이블, 신규 추가된 8개 항목 (`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `WORKSPACE_ID_REQUIRED`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`)
  - 상세: 모든 신규 한국어 메시지가 스택 트레이스·내부 경로·서버 구현 세부사항·인증 토큰 등을 포함하지 않고 사용자 친화적 안내문만 담고 있다. 에러 코드 식별자 자체가 사용자에게 노출되지 않고 번역된 메시지만 노출되므로 에러 메시지를 통한 정보 유출 위험 없음. `BOT_TOKEN_INVALID` 의 메시지("봇 토큰이 유효하지 않아요 (제공자 인증 401/403)")에 HTTP 상태 코드가 포함되나 이는 사용자가 올바른 조치를 취하도록 안내하는 수준이므로 보안 문제로 볼 수 없다.

### 파일 1 & 2: 문서 파일 (triggers.mdx, triggers.en.mdx)

- **[INFO]** 에러 코드 Callout 변경 — 보안 관련 없음
  - 위치: Chat Channel 에러코드 안내 Callout 섹션
  - 상세: 두 문서 모두 에러 코드 식별자 목록(`INVALID_BOT_TOKEN` 등)을 나열하고 있으나 이는 사용자 안내 목적이며, 에러 코드 이름이 공개됨으로써 발생하는 추가적인 공격 벡터는 없다. 에러 코드는 내부 인증 로직의 세부사항을 드러내지 않는다.

### 파일 3: codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts

- **[INFO]** 테스트 코드 변경 — 보안 관련 없음
  - 위치: `LOCALIZED_ERROR_CODES` 배열, `translateBackendError` 단위 테스트 케이스 추가
  - 상세: 하드코딩된 시크릿 없음. 테스트 케이스의 `fallback` 문자열은 임의의 테스트용 문자열이며 실제 인증 정보나 민감 데이터가 포함되지 않는다.

### 파일 5, 7, 8, 9: 계획/리뷰 문서

- **[INFO]** 계획·리뷰 문서 변경 — 보안 관련 코드 없음
  - 상세: `plan/`, `review/` 디렉토리 내 마크다운 파일로 런타임 코드가 아니며 보안 취약점 해당 없음. 문서 내 내부 경로(`/Volumes/project/...`)가 포함되어 있으나 이는 개발 환경 로컬 경로이며 배포 산출물에 포함되지 않는다.

---

## 요약

이번 변경 set 은 chat-channel 에러 코드의 i18n 한국어 매핑 추가(`backend-labels.ts`/`backend-labels.test.ts`), 프론트엔드 문서 현행화(`triggers.mdx`, `triggers.en.mdx`), Cafe24 카탈로그 생성기의 컨테이너 필드 fallback 로직 버그 수정(`_generator.py`), 계획·리뷰 문서 메타데이터 정비로 구성된다. 하드코딩된 시크릿, SQL/XSS/커맨드 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘, 민감 정보 에러 노출 등 주요 보안 취약점은 발견되지 않았다. 유일한 보안 관련 사항은 `_generator.py` 의 `entity_id` 기반 캐시 경로 구성에서 이론적 경로 트래버설 가능성이나, 입력 출처가 신뢰된 Cafe24 공식 HTML이고 개발자 전용 CLI 도구인 점을 감안하면 실제 공격 면은 극히 제한적이며, 방어적 코딩 개선 권고 수준이다.

## 위험도

LOW

STATUS: SUCCESS

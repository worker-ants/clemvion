# Security Review

## 발견사항

### 파일 6: spec/conventions/cafe24-api-catalog/_generator.py

- **[INFO]** `entity_id` 파라미터가 캐시 파일 경로에 그대로 사용됨
  - 위치: `fetch_entity_json()` 함수, `cache = os.path.join(cache_dir, entity_id + ".json")` 라인
  - 상세: `entity_id` 는 HTML 파싱으로 추출된 값으로, `../` 같은 경로 트래버설 시퀀스를 포함할 경우 `cache_dir` 범위 밖의 경로를 덮어쓸 수 있다. 다만 이 스크립트는 개발자가 직접 실행하는 CLI 도구이며, 입력 HTML 은 신뢰할 수 있는 Cafe24 공식 API 문서이므로 실제 공격 면은 매우 제한적이다.
  - 제안: `os.path.basename(entity_id)` 또는 정규화 후 `os.path.abspath`와 `startswith(cache_dir)` 검사를 추가하여 경로를 `cache_dir` 내로 한정.

- **[INFO]** `_http_get()` 에서 URL 을 `subprocess.run(["curl", ..., url])` 에 리스트 인자로 전달 — 셸 인젝션 위험 없음
  - 위치: `_http_get()` 함수
  - 상세: `subprocess.run` 호출 시 리스트 형식으로 인자를 전달하고 있어 셸 인젝션은 발생하지 않는다(올바른 구현). 변경 범위 밖의 기존 코드이지만, 리뷰 완료 확인 차원에서 기록.

- **[INFO]** `fetch_entity_json()` 에서 캐시 파일 쓰기 시 `entity_id` 포함 경로를 직접 `open(..., "w")` 로 처리
  - 위치: `with open(cache, "w", encoding="utf-8") as f: f.write(body)` 라인
  - 상세: 위 경로 트래버설 이슈와 동일한 맥락. 캐시 쓰기 시점에도 동일하게 검증이 필요하다.

### 파일 2: codebase/frontend/src/content/docs/02-nodes/triggers.mdx

- **[INFO]** 문서 변경 내용은 보안과 무관 — 에러 코드 UI 메시지 표현 변경만 포함
  - 위치: Chat Channel Callout 섹션
  - 상세: "일부 코드는 현재 영문 메시지 그대로 화면에 노출될 수 있어요" → "한국어 화면에서는 모두 한국어 안내 메시지로 표시돼요" 로 변경. 에러 코드 자체(`INVALID_BOT_TOKEN` 등)는 사용자에게 노출되지 않고 내부 식별자로만 쓰이며, 대응되는 한국어 메시지가 `ERROR_KO` 테이블에 등록됨(파일 4 변경). 정보 유출 측면에서 문제 없음.

### 파일 3 & 4: i18n 에러 코드 매핑 추가

- **[INFO]** 에러 코드 문자열(`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND` 등)이 `ERROR_KO` 테이블에 한국어 메시지로만 등록됨
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` 라인 1158–1168
  - 상세: 한국어 메시지가 스택 트레이스·내부 경로·시스템 정보를 포함하지 않고 사용자 친화적 안내문만 담고 있다. 에러 코드 열거 자체가 서버 내부 구조를 노출하지 않으므로 보안 문제 없음.

### 파일 1 & 5: plan 문서

- **[INFO]** 계획 문서 변경으로 보안 관련 코드 변경 없음.

## 요약

이번 변경은 chat-channel 에러 코드의 i18n 한국어 매핑 추가, 프론트엔드 문서의 에러 메시지 표현 개선, Cafe24 카탈로그 생성기의 컨테이너 필드 fallback 로직 개선, plan 문서 메타데이터 수정으로 구성된다. 하드코딩된 시크릿, SQL/XSS/커맨드 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘, 민감 정보 에러 노출 등 주요 보안 취약점은 발견되지 않았다. `_generator.py` 의 `entity_id` 기반 캐시 파일 경로 구성에서 경로 트래버설 가능성이 이론적으로 존재하나, 입력 출처가 신뢰된 Cafe24 공식 HTML이고 개발자 전용 CLI 도구인 점을 감안하면 실제 공격 면은 극히 제한적이다. 해당 부분은 방어적 코딩 차원에서 경로 정규화 추가를 권장하는 수준이다.

## 위험도

LOW

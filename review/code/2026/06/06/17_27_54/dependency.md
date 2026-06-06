# 의존성(Dependency) 리뷰 결과

## 발견사항

### 발견사항 없음 — 신규 외부 의존성 추가 없음

이번 변경은 다음 3개 파일로 구성된다.

1. `codebase/backend/test/execution-park-resume.e2e-spec.ts` — e2e 테스트 로직 변경
2. `docker-compose.e2e.yml` — e2e 인프라 환경변수 수정
3. `spec/5-system/14-external-interaction-api.md` — spec 문서 갱신

---

**[INFO] 신규 외부 패키지 없음**
- 위치: `execution-park-resume.e2e-spec.ts` import 선언
- 상세: 변경된 테스트 파일의 import 는 `@jest/globals`, `crypto`(Node.js 표준), `jsonwebtoken`, `pg`, `supertest`, 내부 helpers 로만 구성된다. 이 중 `jsonwebtoken`(9.0.3 고정), `pg`(^8.20.0), `supertest`(^7.0.0) 는 기존 `package.json`에 이미 선언된 의존성이다. 신규 추가 항목 없음.
- 제안: 해당 없음.

**[INFO] 기존 `jsonwebtoken` 버전 고정 유지**
- 위치: `codebase/backend/package.json` — `"jsonwebtoken": "9.0.3"`
- 상세: `sign()` 호출이 이번 변경(mintInteractionToken)에서 활성화되었으나, 패키지 자체는 이미 정확한 버전(`9.0.3`)으로 고정되어 있다. CVE 측면에서 jsonwebtoken 9.x 계열은 알려진 critical 취약점이 없다(8.x 이하에서 수정된 CVE-2022-23529 등은 9.x 에 해당 없음).
- 제안: 해당 없음.

**[INFO] `docker-compose.e2e.yml` ENCRYPTION_KEY 길이 교정 — 의존성 무관, 환경 설정**
- 위치: `docker-compose.e2e.yml:138`
- 상세: `ENCRYPTION_KEY`가 32-char(16 byte)에서 64-hex(32 byte)로 교정되었다. 이는 외부 패키지 의존성이 아닌 내부 `crypto.util.ts`(Node.js 내장 `crypto` 모듈 기반 AES-256-GCM)의 키 길이 요구사항에 맞춘 환경 설정 수정이다. 새로운 라이브러리·패키지 의존 없음.
- 제안: 해당 없음.

**[INFO] 내부 의존 관계 — DB 직접 insert 제거, 공개 API 경유로 단순화**
- 위치: `execution-park-resume.e2e-spec.ts` 변경 전후
- 상세: 이전에는 llm_config 행을 `db.query(INSERT ...)` 로 직접 삽입해 암호화 경로를 우회했다. 변경 후 `POST /api/llm-configs` REST API를 경유하므로 테스트가 내부 DB 스키마에 직접 의존하지 않고 공개 API 표면에만 의존한다. 내부 의존 관계 방향이 더 올바르게 정렬되었다.
- 제안: 해당 없음.

**[INFO] `crypto` 모듈 사용 — Node.js 내장**
- 위치: `execution-park-resume.e2e-spec.ts:2` (`import { randomUUID } from 'crypto'`)
- 상세: 변경 전후 모두 사용 중인 Node.js 내장 모듈. 외부 패키지 아님.
- 제안: 해당 없음.

---

## 요약

이번 변경(PR-B2a followup)은 새로운 외부 패키지를 전혀 추가하지 않는다. 수정된 파일은 e2e 테스트 1개, docker-compose 환경설정 1개, spec 문서 1개이며, 기존 의존성(`jsonwebtoken`, `pg`, `supertest`, Node.js 내장 `crypto`)만 활용한다. 버전 고정 상태도 변경 없이 유지된다. 오히려 DB 직접 insert 우회를 공개 API 호출로 대체하여 테스트의 내부 스키마 직접 의존을 제거한 점이 의존성 위생 측면에서 긍정적이다.

## 위험도

NONE

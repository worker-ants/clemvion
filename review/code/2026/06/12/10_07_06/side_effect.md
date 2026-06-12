# 부작용(Side Effect) 리뷰 결과

리뷰 대상: 48개 파일 (review/consistency/** 40개 산출물 + spec/** 8개 실질 변경)
분석 기준: diff-base = origin/main

---

## 발견사항

### [INFO] review/consistency/** 산출물 — 부작용 없음

- **위치**: 파일 1-40 (`review/consistency/2026/06/12/00_31_31/**`, `00_54_14/**`, `00_58_09/**`, `01_19_26/**`, `07_37_07/**`, `07_45_38/**`)
- **상세**: 이 파일들은 일관성 검토 서브에이전트가 생성한 Markdown/JSON 산출물이다. 전부 `new file mode`(신규 생성)이며 기존 파일을 수정하지 않는다. `_retry_state.json` 파일들은 오케스트레이터 내부 상태 추적용 파일로, 특정 worktree 경로(`audit-sot-hygiene-8fc5f1`, `spec-errcode-catalog-a09758`, `db-host-blocked-7df9f7`)에 하드코딩된 절대 경로를 포함하지만 실행 시 단순 읽기 참조용으로 외부 부작용을 유발하지 않는다.
- **제안**: 없음.

---

### [INFO] `spec/conventions/error-codes.md` — §4 섹션 신설, 기존 §3 Rationale 섹션 번호 영향 없음

- **위치**: 파일 47, 라인 `+## 4. 내부 전용 분류 코드 (정규화 후 발행)` 삽입
- **상세**: `## Rationale` 절은 번호 없는 헤딩이라 `## 4.` 신설이 `## Rationale` 앵커를 변경하지 않는다. `spec-link-integrity.test.ts` 가 slug 를 검증하므로 빌드 통과 여부로 확인 가능. 기존 `§3` cross-reference 링크에는 영향이 없다.
- **제안**: CI 빌드(`spec-link-integrity.test.ts`) 통과 확인으로 충분.

---

### [INFO] `spec/conventions/node-output.md` — D4 주석 앵커 링크 교체

- **위치**: 파일 48, `[1-http-request.md §5.8]` 링크의 앵커가 `#58-d4-handlervalidate-실패만-throw-나머지-모두-53-으로-라우팅` 으로 갱신
- **상세**: 앵커 링크 텍스트 수정으로 동작 변경 없음. `spec-link-integrity.test.ts` 빌드 가드가 slug 정합성을 런타임에 검증한다.
- **제안**: 빌드 가드 통과 확인으로 충분.

---

### [INFO] `spec/5-system/3-error-handling.md` — `EXECUTION_TIMEOUT` 설명 확장 및 `DB_HOST_BLOCKED` 추가

- **위치**: 파일 45, §1.4 및 §3.2 테이블 수정
- **상세**: 두 테이블 행의 텍스트 변경이며 spec 문서 수정이다. 코드 동작에 직접 영향을 미치지 않는다. `DB_HOST_BLOCKED` 를 Database 카테고리에 추가한 것은 `codebase/backend/src/nodes/core/error-codes.ts` 에 이미 반영된 코드를 카탈로그에 등재한 것으로 코드베이스 부작용 없다.
- **제안**: 없음.

---

### [INFO] `spec/conventions/chat-channel-adapter.md` — `HTTP_TIMEOUT(미발행)` 주석 추가

- **위치**: 파일 46, `HTTP_TIMEOUT` 행에 "(미발행)" 텍스트 추가 및 설명 블록 신설
- **상세**: spec 문서 수정으로 실제 `execution-failure-classifier.ts` 로직 변경 없음. 분류 표 행 자체가 유지되므로 기존 코드가 참조하는 매핑은 변경되지 않는다.
- **제안**: 없음.

---

### [INFO] `spec/4-nodes/5-data/2-code.md` — 2단 async 래퍼·vars copy-out·라인 오프셋 명세 추가

- **위치**: 파일 44, §4 실행 로직 및 §5.3 공통 필드 표 수정
- **상세**: spec 문서가 구현 사실을 반영하는 방향이며 코드 변경을 수반하지 않는다. `output.error.details.legacyCode` 설명에 cross-reference 링크(`conventions/error-codes.md §4`)가 추가된 것은 문서 추적성 개선으로 런타임 동작 변화 없다. `$helpers.crypto.hash` 설명에 허용 알고리즘 목록 및 `md5`/`sha1` 보안 경고를 추가했으나 이는 spec 문서상의 경고이며 코드 차단 로직 변경은 아니다.
- **제안**: 없음.

---

### [INFO] `spec/4-nodes/4-integration/1-http-request.md` — dry-run SSRF 생략 명시, Usage 로그 주석, `output.response.error` Deprecated 태그

- **위치**: 파일 42, §4 step 8, §4.2 주석 신설, §5.3 테이블 설명 변경
- **상세**: 모두 spec 문서 내 설명 보강이다. `output.response.error` 를 "Deprecated (legacy 호환 잔재)" 로 명시한 것은 공개 API 필드에 폐기 표시를 한 것이지만, 필드 자체 제거가 아니어서 기존 사용자 호환성에 즉각적 영향은 없다. dry-run 시 SSRF 가드를 생략한다는 명세가 추가됐으나 이는 이미 구현에 반영된 동작을 문서화한 것이다.
- **제안**: 없음.

---

### [INFO] `spec/2-navigation/4-integration.md` — `DB_HOST_BLOCKED`, `HTTP_BLOCKED` 행 추가

- **위치**: 파일 41, §10.3 에러 코드 vocabulary 표
- **상세**: 기존 표에 두 행 삽입이며 spec 문서 내 추가이다. 기존 행을 수정하지 않으므로 기존 참조에 영향 없다.
- **제안**: 없음.

---

## 요약

이번 변경은 총 48개 파일로 구성되며, 40개는 일관성 검토 서브에이전트 산출물(순수 신규 생성 문서), 8개는 `spec/**` 내 spec 문서 수정이다. spec 문서 변경 8개 모두 기존 구현 코드의 동작을 사후 문서화하거나 설명을 보강하는 성격이며, 신규 공개 API 도입·함수 시그니처 변경·전역 상태 변경·환경 변수 변경·이벤트/콜백 변경을 포함하지 않는다. `output.response.error` 필드의 "Deprecated" 태그 추가는 향후 제거를 예고하나 이번 diff에서 즉각적인 인터페이스 제거는 없다. 앵커 링크 교체 2건은 `spec-link-integrity.test.ts` 빌드 가드로 정합성이 검증된다. 의도치 않은 부작용은 발견되지 않았다.

## 위험도

NONE

# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** spec-only 변경 — 런타임 부작용 없음
  - 위치: `spec/conventions/secret-store.md` 전체 diff, `spec/5-system/1-auth.md` 전체 diff
  - 상세: 두 파일 모두 순수 markdown 문서다. 런타임에 로드되는 코드가 아니므로 함수 시그니처·전역 상태·파일시스템·네트워크·이벤트 콜백에 직접적인 부작용을 일으키지 않는다.
  - 제안: 해당 없음.

- **[INFO]** `secret-store.md §3.3` 에 새로 명시된 `assertProductionConfig` 거부 동작은 이미 구현 완료된 사실의 문서화
  - 위치: `spec/conventions/secret-store.md` 라인 39 (추가된 bullet)
  - 상세: 실제 동작은 `/codebase/backend/src/common/config/production-guards.ts` 의 `assertProductionConfig` 와 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` Set 이 수행한다. `main.ts` bootstrap 첫 단계에서 이미 호출 중임이 확인된다. spec 추가는 구현 사실의 사후 문서화이며, 새로운 부작용을 도입하지 않는다.
  - 제안: 해당 없음.

- **[INFO]** `spec/5-system/1-auth.md` 의 기존 `JWT_SECRET fail-closed` 인라인 설명 단축 + `## Rationale` 섹션 이관
  - 위치: `spec/5-system/1-auth.md` 245~253행(삭제), 550~574행(추가)
  - 상세: 기존 7행짜리 설명이 3행으로 축약되고 상세 근거는 `## Rationale` 로 이동했다. 내용 변경이 없고 참조 링크(`[secret-store §Rationale]`, `[11-mcp-client]`)가 신규 추가됐다. 이는 문서 구조 정리이며 동작 변화 없다.
  - 제안: 해당 없음.

- **[INFO]** `spec/conventions/secret-store.md §3.3` 에 `.env.example` 표준 형식 표현 미세 수정 ("표준" → "표준 형식")
  - 위치: `spec/conventions/secret-store.md` 라인 36
  - 상세: 표현 명확화 목적의 단어 추가. 의미·동작 변경 없음.
  - 제안: 해당 없음.

---

## 부작용 관점별 점검 결과

| 관점 | 결과 |
|---|---|
| 의도치 않은 상태 변경 | 없음 — 문서 파일 변경. 코드 없음 |
| 전역 변수 | 없음 |
| 파일시스템 부작용 | 없음 |
| 시그니처 변경 | 없음 — `SecretResolver` 인터페이스·`assertProductionConfig` 시그니처 변경 없음 |
| 인터페이스 변경 | 없음 — 공개 API 변경 없음 |
| 환경 변수 | 없음 — 기존 `ENCRYPTION_KEY` 거부 동작(production-guards.ts 이미 구현)을 spec 에 명시한 것뿐. 새 env 읽기/쓰기 도입 없음 |
| 네트워크 호출 | 없음 |
| 이벤트/콜백 | 없음 |

---

## 요약

이번 변경은 두 spec 문서(`spec/conventions/secret-store.md`, `spec/5-system/1-auth.md`)에 국한된 순수 문서 변경이다. 변경 내용은 (1) 이미 구현 완료된 `assertProductionConfig` 의 `ENCRYPTION_KEY` 거부 동작을 spec §3.3 에 명시하고, (2) `JWT_SECRET fail-closed` 상세 근거를 `## Rationale` 섹션으로 이관하며, (3) cross-link 참조를 추가한 것이다. 어떤 코드 경로·함수 시그니처·환경 변수 접근 패턴도 변경되지 않았으며, 구현 파일(`production-guards.ts`, `main.ts`)은 이미 이 동작을 구현 및 단위 테스트로 검증하고 있음이 확인된다. 의도하지 않은 부작용은 발견되지 않는다.

---

## 위험도

NONE

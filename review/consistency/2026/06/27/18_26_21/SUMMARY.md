# Consistency Check 통합 보고서 (--impl-done, scope=spec/2-navigation/)

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — `mc-modellistdto-fix` 구현 변경 자체는 spec 과 **완전 정합**(위반 0). 발견된 WARNING/INFO 는 모두 scope(`spec/2-navigation/`) 내 **기존 문서**의 doc-quality 문제로, 본 변경과 독립적(scope 스캔이 우연히 노출).

## Critical 위배 (BLOCK 사유)
없음.

## 경고 (WARNING) — 전부 본 변경과 무관한 pre-existing

| # | Checker | 위배 | target | 처리 |
|---|---------|------|--------|------|
| 1 | Convention | `10-auth-flow.md` 서브섹션 번호 역순(§2.6→§2.5) | `spec/2-navigation/10-auth-flow.md` | **out-of-scope** — 본 PR 미터치, 별 spec-fix |
| 2 | Convention | `14-execution-history.md §5` 응답 예시에 TransformInterceptor 래퍼 주의 문구 누락 | `spec/2-navigation/14-execution-history.md` | **out-of-scope** — 별 spec-fix |

> 두 WARNING 모두 본 PR 이 만지지 않은 nav spec 파일. 끌어들이면 scope 위반 → 별 트랙. BLOCK NO.

## 참고 (INFO) — 발췌

- **구현 정합 확인**: `ModelInfoDto.{id,name,type}` 는 `ModelInfo` 인터페이스 충실 미러. `ModelListDto`→bare array 전환은 `7-llm-client §3.5` 계약(이미 `ModelInfo[]`)에 Swagger 를 맞춘 것 — 어떤 spec 과도 충돌 없음 (Cross-Spec/Rationale 확인).
- 8 | Naming | `ModelInfoDto` ↔ `ModelInfo` 의도적 미러, 충돌 없음. shape 변경 시 3지점(domain/DTO/frontend) 동시 갱신 주의.
- 9 | Naming | `ModelListDto`/`ModelItemDto` dist `.d.ts` 잔존 — 빌드 산출물, 다음 tsc 로 자동 해소(src 참조 0).
- 1–7,10 | 기타 nav spec doc-quality(아이콘·경로 prefix·Overview·R-2 TBD·PreviewModelListDto rename) — 전부 pre-existing/out-of-scope.

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| Cross-Spec | LOW | 구현 변경 완전 정합. nav 표기 비일관 3건(INFO, 무관) |
| Rationale Continuity | NONE | 위반 없음 — `ModelListDto` 래퍼 채택 선행 결정 자체가 없었고 수정이 설계 의도 부합 |
| Convention Compliance | LOW | WARNING 2건 전부 pre-existing nav doc 결함(무관) |
| Plan Coherence | NONE | in-progress plan 전부 정합 |
| Naming Collision | LOW | `ModelInfoDto` 충돌 0, dist 잔존 INFO |

## 결론

본 변경에 대한 spec↔code 위배 **없음**. WARNING 2건은 무관 pre-existing nav doc → 별 spec-sync 트랙. **BLOCK: NO** — push 가능.

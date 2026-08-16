# Code Review 통합 보고서

## 전체 위험도

**LOW** — **CRITICAL 0 · WARNING 6**. reviewer **14명 전원 실행**(강제 7 + 나머지 7), skip 0건.
`agents_forced` 미이행 없음.

> 라우터 결정을 신뢰하는 대신 14명 전수를 띄웠다 — forced 커버리지가 구조적으로 보장되고
> 라우터 산출 파일명 불일치(기존 결함)에 걸리지 않는다.
>
> `user_guide_sync` reviewer 는 `output_file` 이 디스크에 남지 않아(worktree sub-agent write
> 격리) main 이 반환 전문으로 **재영속화**했다 — 내용 손실 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 조치 |
|---|---|---|---|---|
| 1 | performance | `nodeExecutions` uncapped 배열에 무조건 spread — 자매 `reconcilePreParkWaitingStatus` 의 copy-on-change 관례를 이 배열 위에서만 깬다. 진행 중 실행은 캐시 대상이 아니라 폴링·WS 재연결마다 재계산 | `executions.service.ts` `findById` | **수정** — `error` 있는 행만 복제 |
| 2 | maintainability | `as Execution` 캐스트가 `redactStoredErrorForResponse` 의 `\| null` 반환을 지워, 이후 `.error` null-check 누락을 컴파일러가 못 잡는다 | `executions.service.ts` `toResponseExecution` | **수정** — `ResponseExecution` 명시 타입 |
| 3 | side_effect | `stop()` 반환값 정체성·내용이 조용히 바뀜(엔티티 참조 → 마스킹 복사본, relation strip 추가) | `executions.service.ts` `stop` | **문서화** — JSDoc + 실측(관계 미로드라 사라지는 필드 없음) |
| 4 | testing | JSDoc 이 명시한 "레거시 문자열·숫자 통과" 보장이 테스트로 고정되지 않음 | `redact-stored-error.ts` / `.spec.ts` | **수정** — 케이스 2건 추가 |
| 5 | documentation | `CHANGELOG.md` 미갱신 — 동일 계열 직전 6개 커밋(#1171~#1177)이 전부 지킨 "wire 변화" 기록 관행 | `CHANGELOG.md` | **수정** — `## Unreleased` 추가 |
| 6 | documentation | plan 체크박스가 같은 diff 안에서 이미 완료된 항목을 미완료로 표기 | `eia-internal-rest-error-masking.md` | **수정** — `[x]` |
| 7 | requirement | "표면 전수" 주장이 실제로 전수가 아님 — workflow-assistant LLM 도구가 같은 두 컬럼을 더 약한(키-기반) 마스킹으로 내보냄 | `explore-tools.service.ts:464,484` | **되돌리고 등재** — 아래 |

### #7 상세 — 처방을 실측이 반증했다

합성(값-패턴 마스킹 추가)을 적용하니 **기존 테스트가 RED**. `maskSensitiveFields` 는 자격증명
키에 `****9876` 접미 힌트를 남기는데(어떤 키가 가려졌는지 식별용) 값-패턴 마스킹이 이를 덮는다.
**테스트를 변경에 맞춰 고치지 않고 변경을 되돌렸고**, 두 마스킹 의미의 우선순위를 정본 트래커에
결정 항목으로 등재했다. 동시에 spec §R17 의 주장을 총칭에서 **열거**로 좁혔다.

## 참고 (INFO)

- **architecture(5)** — 응답 마스킹이 framework 강제가 아니라 호출부 명시 호출에 의존(저장소
  전반 관용, 장기 리스크로 별도 추적) · `toResponseExecution` 이 두 책임을 의도적 결합 ·
  leaf 유틸 배치와 순환 회피는 **양호** · 보장 경계를 캐너리로 고정한 점 **양호** ·
  `pending_plans` 키 의미 오버로딩
- **security(3)** — 이번 diff 는 신규 취약점이 아니라 **기존 CWE-209 계열 정보노출을 닫는
  보안 수정**. 잔여 표면(WS node emit · `inputData`/`outputData` · `triggerToken`)은 전부
  트래커 등재 범위 밖
- **database(5) · concurrency(0) · dependency(4) · api_contract(3) · scope(2)** — 위험도
  NONE~LOW. 쿼리·인덱스·트랜잭션 경계 무변경, 신규 의존성 0, 응답 DTO 스키마와 정합해
  breaking change 없음, 범위 이탈 없음
- **user_guide_sync(1)** — `run-debug-flow-change` 회색지대, 가이드가 틀려지는 지점 없어 조치 불요

## 조치 결과

전 항목 처리 완료 — [`RESOLUTION.md`](./RESOLUTION.md) 참조.

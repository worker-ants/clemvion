---
worktree: integration-expiry-fixes-1d7c7d
started: 2026-06-11
owner: resolution-applier
spec_impact:
  - spec/data-flow/5-integration.md
---
# Spec Update Draft — integration expiry mermaid diagram status_reason

## 분류
SPEC-DRIFT (코드 개선을 spec 에 반영) — V-07 fix 로 구현은 `status_reason='token_expired'` 를 기록하도록 이미 수정됐으나 spec §1.4 sequenceDiagram 한 줄만 갱신되지 않고 `status_reason=NULL` 이 잔존함.

## 원본 발견사항
SUMMARY#1: `spec/data-flow/5-integration.md` §1.4 mermaid sequenceDiagram 내 `status_reason=NULL` 표기가 잔존. V-07 변경(0d 격하 시 `statusReason='token_expired'`)이 §1.4 표·의사코드에는 반영됐으나 같은 섹션 다이어그램에만 누락됨. 해당 라인: `Scan->>PG: UPDATE integration SET status='expired', status_reason=NULL`

## 제안 변경

**파일**: `spec/data-flow/5-integration.md`
**위치**: §1.4 sequenceDiagram, `else 그 외 전부` 분기

**Before** (현재 라인 282):
```
        else 그 외 전부
          Scan->>PG: UPDATE integration SET status='expired', status_reason=NULL
```

**After** (수정안):
```
        else 그 외 전부
          Scan->>PG: UPDATE integration SET status='expired', status_reason='token_expired'
```

**근거**: 구현 코드 `integration-expiry-scanner.service.ts` 의 `run()` 함수 (라인 408-411):
```ts
integration.status = 'expired';
integration.statusReason = 'token_expired';
```
V-07 fix 가 `statusReason` 을 `null` 에서 `'token_expired'` 로 변경. spec §1.4 표·Rationale 은 이미 갱신됐으나 같은 섹션의 sequenceDiagram 라인만 누락. 표와 다이어그램이 상충하는 상태 해소 필요.

## 추가 컨텍스트

- `spec/data-flow/5-integration.md` 라인 363 (상태도)에도 유사한 잔존 표기 확인 필요:
  `connected --> expired: 만료 스캐너 0d (refresh-capable cafe24 가 아닌 모든 행, status_reason=NULL)`
  → `status_reason='token_expired'` 로 갱신 권장.

## 적용 결과 (2026-06-11)

- [x] §1.4 sequenceDiagram 을 §11.2 구조(refresh-capable claim/격하/알림 제외, refresh_token-less 만 token_expired 격하)로 재작성 + state diagram `status_reason=NULL`→`token_expired` 정정. main 직접 적용 (텍스트 현행화, 신규 결정 없음 — 직후 --impl-done 으로 검증).

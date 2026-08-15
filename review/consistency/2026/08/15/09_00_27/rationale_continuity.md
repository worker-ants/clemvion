# Rationale 연속성 검토 결과

## 검토 범위 정정 (선행 확인)

prompt 의 "Target 문서" 는 `spec/5-system/` 전체를 --impl-prep 번들로 담고 있다. 로컬 상태를
`git diff origin/main`으로 대조한 결과, 이번 라운드에서 `spec/5-system/14-external-interaction-api.md`
에 실제로 가해진 변경은 단 한 줄이다 (커밋 `cdaa4291d` "인접 두 줄이 자기모순 — Re-run 경로에
금지된 `/v1/` 세그먼트"):

```
-  Re-run API (`POST /api/v1/executions/:id/re-run`, ...)
+  Re-run API (`POST /api/executions/:id/re-run`, ...)
```

이 워크트리는 이름(`eia-r8-cache-scope-4ae434`)과 무관하게 재사용 중이며, plan
(`eia-terminal-payload.md`)이 스스로 이를 명시한다. R8(Idempotency-Key 캐시 스코프) 결정은
이미 완료·병합된 상태(spec #1156, 코드 #1157~#1163)이고, 직전 라운드(`08_45_50`)에서 이미
"target 전역에서 완전히 보존됨(액션 불필요)"로 확인됐다. 본 라운드는 그 결론 위에 (1) `/v1/`
제거 diff, (2) `08_45_50` INFO 1 권고(Planned 캐비엇 삭제 대신 "해소" 보존)가 이후 plan
갱신(`eia-terminal-payload.md` "재판정 ④")에 실제로 반영됐는지를 추가로 확인했다.

## 발견사항

없음.

- **`/v1/` 제거 diff는 Rationale 위반이 아니라 기존 위반의 해소다.** [API 규약 §2.1](../../../../../../spec/5-system/2-api-convention.md#21-기본-패턴)
  기본 URL 패턴 `{base_url}/api/{resource}`에는 버전 세그먼트가 없고, EIA 문서 자신도 §6.2
  본문 주석(L692)에 "절대 URL·`/v1/` 버전 세그먼트는 [API 규약 §1] 위반"이라고 명시한다.
  `spec/5-system/13-replay-rerun.md`(Re-run 의 SoT)의 실제 엔드포인트 표기도 처음부터
  `POST /api/executions/:executionId/re-run`(버전 없음)이었다 — §8.1 및 다수 cross-ref 확인.
  즉 EIA §12 호환성 절의 `/v1/` 표기가 두 SoT(자기 자신의 §6.2 캐비엇, 13-replay-rerun.md)와
  모순인 오탈자였고, 이번 diff는 그 모순을 SoT 쪽으로 정정한 것이다. 새 결정을 도입하지도,
  과거에 기각된 대안을 되살리지도 않는다.
- **R8(캐시 키 스코프) 은 이번 라운드에서 재확인**: `spec/5-system/14-external-interaction-api.md`
  §R8(execution+route 스코프, 토큰/jti 스코프·전역 키 기각), EIA-IN-11, EIA-RL-02가 서로 정합하고,
  `plan/complete/eia-distributed-seq-counter.md`를 인용하는 §R7의 "(c) Redis-only 확정, DB
  fallback 폐기" 서술도 해당 plan 파일의 실제 결정과 일치함을 재확인했다. 이 결정을 재도입·번복
  하려는 변경은 이번 diff·plan 갱신 어디에도 없다.
- **`08_45_50` INFO 1(durationMs Planned→구현됨 전환 시 "해소" 형태 보존) 은 plan에 선반영됨**:
  `plan/in-progress/eia-terminal-payload.md` "재판정 ④" 말미에 "Planned 캐비엇은 지우지 말고
  '(해소)'로 보존한다 (`08_45_50` rationale_continuity INFO 1). §6.4 `error` 전환 때 실제로 그렇게
  했다"라는 문구로 명시적으로 계승됐다 — 아직 spec 본문 편집 자체는 착수 전(체크박스 미완료)
  이므로 검증은 다음 라운드(실제 §6/§6.3~§6.5 편집 시점)에서 재확인이 필요하다.

## 요약

이번 라운드에서 `spec/5-system/`에 가해진 유일한 실질 변경(`/v1/` 세그먼트 제거)은 문서 자신의
§6.2 캐비엇과 `13-replay-rerun.md` SoT 표기에 이미 못박혀 있던 규칙을 뒤늦게 맞춘 정정이며,
Rationale 어느 항목도 재도입·번복하지 않는다. 이 워크트리 이름이 가리키는 R8(Idempotency-Key
캐시 스코프) 결정은 이미 완료·병합돼 있고 이번 diff 로도 건드려지지 않았다. 직전 라운드가 남긴
유일한 개선 여지(Planned→구현됨 전환 시 "해소" 형태 보존)는 이미 계획 문서에 명문화돼 다음
구현 라운드에서 지켜질 준비가 됐다 — 실제 spec 편집이 아직 없어 결과 검증은 보류.

## 위험도

NONE

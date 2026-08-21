# 보안(Security) Review — masked-marker-contract-7d2e14 (라운드 6, 13_55_59)

## 검토 방법

이 PR 은 backend `sanitize-error-message.ts` 와 frontend `lib/utils/masked-markers.ts` 에 손으로
복제돼 있던 egress 마스킹 마커 집합(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)·정확 일치
판정(`isMaskedMarker`)·깊이 상한(`MAX_MASK_DEPTH`=10)을 신규 공유 패키지
`@workflow/masked-markers` 로 추출하는 리팩터다. 이미 5라운드 리뷰(`11_27_29`~`13_34_34`)를
거쳤고 그중 보안과 직접 관련된 WARNING(마커 미러 소멸 가드의 `SOT_DIR` 경로 접두-겹침 비대칭,
`12_50_37`/`13_14_29`)이 이미 지적·수정됐다는 이력이 프롬프트에 포함돼 있었다. 과거 라운드의
"고쳤다" 서술을 그대로 믿지 않고, 다음을 직접 `Read` 로 현재 저장소 상태에서 재검증했다 —

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` 전문 — 마스킹 정규식
  (`SECRET_LEAK_PATTERNS`), `MAX_REDACT_DEPTH` 별칭, `isMaskedMarker`/`MASKED_MARKERS` 재export
- `codebase/frontend/src/lib/utils/masked-markers.ts` 전문 — `hasMaskedMarkerLeaf`/`scanForMarker`
  의 값-검사-먼저 순서, `MAX_MASK_DEPTH` 공유
- `codebase/packages/masked-markers/src/index.ts` 전문 — 마커 값·`isMaskedMarker` 구현
- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전문
- `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전문 (backend
  쌍둥이와 라인 단위 대조)

## 발견사항

없음 (Critical/Warning 0건).

이전 라운드가 지적했던 마커-미러-소멸 가드의 `SOT_DIR` 경로 접두-겹침 취약점(WARNING, backend
사본만 수정되고 frontend 사본이 느슨한 `startsWith(SOT_DIR)` 로 남아 향후 `masked-markers-*`
형제 패키지가 스캔에서 조용히 제외될 수 있었던 사례)은 현재 코드에서 **두 파일 모두** 동일한
경계 조건을 쓰고 있음을 직접 대조로 확인했다 —

```
backend  masked-marker-mirror-guard.ts:149  if (relPath === SOT_DIR || relPath.startsWith(`${SOT_DIR}/`)) continue;
frontend masked-marker-mirror-guard.ts:151  if (relPath === sotPrefix || relPath.startsWith(`${sotPrefix}/`)) continue;
```

값-마스킹의 핵심 보안 로직(`SECRET_LEAK_PATTERNS`, `CREDENTIAL_KEY_PATTERN`, bearer/JWT/URI
userinfo 패턴, depth-cap-then-mask-wholesale, "이미 마스킹된 값은 재마스킹하지 않는다" 불변식)은
이 diff 에서 **문자 그대로 동일**하다 — 이관 전후로 정규식·상수·함수 시그니처가 바뀐 곳이 없다.
`MAX_REDACT_DEPTH`(backend 지역 별칭)는 여전히 `10`(공유 패키지 `MAX_MASK_DEPTH`)이고,
`isMaskedMarker`는 여전히 `MASKED_MARKERS.includes(v)` 정확 일치만 본다(부분 포함으로 넓어지지
않음 — 넓히면 `a***b` 같은 정상 값이 프리필 가드에 걸려 오탐이 늘지만, 좁아지는 방향의 결함은
없다). frontend `scanForMarker`는 여전히 "값 검사 먼저, 깊이 검사 나중"이라 상한 지점에 놓인
치환 마커(depth 10)를 놓치지 않는다.

신규 `masked-marker-mirror-guard.ts`(backend/frontend 둘 다)는 `fs.readdirSync`/`ts.createSourceFile`
로 저장소 자신의 소스 트리를 스캔하는 **테스트 전용 정적 가드**다 — 입력이 사용자 제어가 아니라
빌드 시점 파일시스템이므로 경로 탐색·인젝션 표면이 아니고, `src/repo-guards/**`는 프로덕션 빌드에서
제외되어(직전 라운드가 `production-build-devdep` 가드로 확인) 런타임 노출도 없다.

`codebase/packages/masked-markers/package.json`의 `prepare` 스크립트(`node -e "..."`)는 하드코딩된
고정 문자열이고 외부 입력을 셸에 이어붙이지 않으므로 커맨드 인젝션 표면이 아니며, 저장소의 다른
8개 내부 패키지와 문자 그대로 동일한 보일러플레이트다.

CI/Docker/package.json 배선(등록 8곳)·`pnpm-lock.yaml`은 신규 워크스페이스 패키지 하나를
추가할 뿐 외부(비-workspace) 의존성이 새로 추가되지 않았고, `devDependencies` 버전은 형제 패키지
`@workflow/ai-end-reason`과 동일하다 — 알려진 취약점이 있는 신규 라이브러리 도입 없음.

하드코딩된 시크릿·평문 전송·안전하지 않은 해시/암호화·에러 메시지의 민감정보 노출·인증/인가
우회에 해당하는 변경은 이 diff 에 없다.

## 요약

이 PR 은 6라운드째 리뷰이며, 값(마커 3종·깊이 상한)과 마스킹/판정 로직 자체는 첫 라운드부터
지금까지 한 번도 지적된 적이 없다 — 모든 발견은 그 계약을 지키려고 신설한 재발 방지 가드
(`masked-marker-mirror-guard`) 쪽에서 나왔고, 그중 유일하게 보안과 직결된 항목(가드의 경로 접두
경계가 backend/frontend 비대칭이었던 것)은 이전 라운드에서 수정됐다고 서술됐던 바를 이번에 직접
소스를 열어 재확인한 결과 실제로 양쪽 모두 동일한 경계 조건으로 수정되어 있음을 확인했다. egress
시크릿 마스킹의 핵심 방어(정규식 패턴·깊이 상한·정확 일치 판정·재마스킹 금지 불변식)는 이관
전후로 완전히 동일해 회귀가 없다. 신규 표면(공유 패키지·리포-가드 스크립트·`prepare` 스크립트)은
전부 빌드/테스트 시점에만 동작하고 사용자 입력을 다루지 않아 인젝션·인증/인가·암호화 관점의 새
위험을 도입하지 않는다.

## 위험도
NONE

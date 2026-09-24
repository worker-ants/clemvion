# 신규 식별자 충돌 검토 — `spec/5-system` (--impl-prep)

## 선행 확인 — 이 게이트가 실제로 새 식별자를 도입하는가

이번 `--impl-prep` 호출은 진행 중 plan [`plan/in-progress/jest-esm-native-load.md`](../../../../../plan/in-progress/jest-esm-native-load.md) 의 체크리스트 항목
`/consistency-check --impl-prep spec/5-system` 에서 발생했다. 그러나 해당 plan 의 frontmatter 는
`spec_impact: none` 이고, 작업 범위는 다음 두 곳뿐이다:

- jest 실행기를 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 로 바꾸는 스크립트(`package.json` 등)
- `transformIgnorePatterns` 를 기본값(`['/node_modules/']`)으로 되돌리는 jest 설정

즉 **`@nestjs/typeorm` ESM 로딩을 CJS jest 가 처리하도록 만드는 테스트 하네스/CI 설정 변경**이며,
요구사항 ID·엔티티·API endpoint·이벤트명·ENV var·spec 파일 경로 등 이 검토자가 점검할 대상이 되는
**신규 식별자를 하나도 도입하지 않는다.**

실측으로 재확인했다: 현재 worktree 의 `spec/5-system/` 은 `origin/main` 대비 **diff 0** 이다.

```
git diff origin/main --stat -- spec/5-system   →  (출력 없음, 변경 없음)
```

따라서 target 으로 번들된 `spec/5-system/1-auth.md` · `2-api-convention.md` · `3-error-handling.md`
(및 컨텍스트 예산으로 생략된 나머지 14개 파일)는 **이미 기존에 커밋되어 있는 상태 그대로**이며, 이
plan 이 새로 부여하는 요구사항 ID·엔티티명·endpoint·이벤트명·ENV var·설정키·파일 경로는 존재하지
않는다. "target 문서가 도입하는 새 식별자" 라는 이 검토 관점의 전제 자체가 이번 실행에는 성립하지
않는다.

## 관점별 점검 (참고용 — 신규 도입 없음을 재확인)

1. **요구사항 ID** — jest 하네스 변경은 요구사항 ID 를 신설하지 않는다. 대상 없음.
2. **엔티티/타입명** — 신설 없음. 대상 없음.
3. **API endpoint** — 신설 없음. 대상 없음.
4. **이벤트/메시지명** — 신설 없음. 대상 없음.
5. **환경변수·설정키** — `--experimental-vm-modules` 는 신규 환경변수가 아니라 jest 프로세스 기동에
   붙이는 Node.js CLI 플래그이며(plan 이 `NODE_OPTIONS=` 접두어 대신 이 형태를 택한 이유도 plan 본문에
   명시), `transformIgnorePatterns` 값 변경은 기존 jest 설정 키를 원복하는 것으로 새 키가 아니다.
   `spec/5-system` 또는 `spec/conventions/` 의 기존 ENV var·config key 사용처와 겹칠 여지가 없다.
6. **파일 경로** — 신규 spec 파일을 만들지 않는다. `spec/5-system` 명명 컨벤션(숫자 접두사 순번)에
   대한 영향 없음.

## 발견사항

없음.

## 요약

이번 `--impl-prep` 실행이 겨냥한 실제 작업(`plan/in-progress/jest-esm-native-load.md`)은
`spec_impact: none` 이 명시된 순수 테스트 하네스/CI 설정 변경(jest 모듈 로딩 방식 전환)이며, 실측상
`spec/5-system` 은 `origin/main` 대비 변경이 전혀 없다. "신규 식별자 충돌" 검토가 전제하는 "target 이
새로 도입하는 식별자"가 이번 스코프에는 존재하지 않으므로, 6개 관점 모두에서 점검 대상이 없고
충돌도 없다. plan 체크리스트의 스코프 지정(`spec/5-system`)이 실제 변경 범위와 불일치한다는 점만
참고로 남긴다 — 다음에 이 plan 의 게이트를 다시 돌릴 때는 스코프를 실제 영향 영역(harness/CI, 즉
spec 비영향)에 맞추는 편이 이 검토자의 예산을 절약한다.

## 위험도

NONE

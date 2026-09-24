# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 주석·헤더 문서가 코드 변경과 정확히 동기화되어 있음 (검증 완료)
  - 위치: `codebase/backend/jest.config.ts:3-11`(모듈 헤더), `:19-41`(`transformIgnorePatterns` 인라인 주석)
  - 상세: 파일 헤더 JSDoc 이 "이 파일이 왜 `package.json` 에서 추출됐는지"를 옛 이유(허용목록 주석)에서 새 이유(허용목록 부재가 의도적임을 설명)로 정확히 갱신했다. `transformIgnorePatterns: ['/node_modules/']` 옆 주석은 (a) 옛 손-유지 허용목록의 문제, (b) 게이트 정체가 Node 버전이 아니라 `--experimental-vm-modules` 플래그라는 점(에러 메시지가 오도한다는 점까지), (c) "두 변경이 쌍" 이라는 불변식, (d) `@nestjs/typeorm@12` 의 `import.meta.url` 처럼 원리적으로 downlevel 불가능한 케이스를 푼다는 점을 전부 포함한다. `plan/in-progress/jest-esm-native-load.md` §A~C 의 실측(게이트 소스 코드 `supportsSyncEvaluate`, Node 24.20 에서도 실패했다는 사실, 두 방향 뮤테이션 RED)과 일일이 대조해 확인했고 불일치가 없다.
  - 제안: 없음 (모범 사례).

- **[INFO]** 새 가드 스펙(`esm-native-load.spec.ts`)의 인라인 주석이 보증 범위를 스스로 좁혀 적음
  - 위치: `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:52-60` (커버리지 경계), `:41-45`·`:125-126`(단위 vs e2e 설정 대조 한계)
  - 상세: "이 가드가 덮지 못하는 것"(script 를 우회하는 IDE 러너·`npx jest` 직접 실행) 과 "행동 검증이 아니라 텍스트/설정 대조"라는 한계를 스스로 명시했다. `test:cov`·`test:watch`·`test:debug` 가 CI·Makefile·`.claude/test-stages.sh`·docker-compose 어디서도 실행되지 않는다는 주장(52-53행)을 직접 grep 으로 재현해 사실임을 확인했다(`grep -rn "test:cov\|test:watch\|test:debug" --include=*.yml --include=*.sh --include=Makefile .` → 0건, `test:e2e` 는 `docker-compose.e2e.yml:209` 에서 실행되므로 목록에서 의도적으로 빠져 있다 — 과잉 일반화가 없다).
  - 제안: 없음. (참고: 이 코멘트는 커밋 메시지 `f14d680ae "「뿐이다」가 또 틀렸고..."` 가 지적한 과거의 과잉 일반화를 이번 라운드에서 실제로 교정한 결과로 보이며, 재확인 결과 이번엔 정확하다.)

- **[INFO]** `PROJECT.md` 정책 문단의 예고(trigger) 정정이 실측과 함께 기록됨
  - 위치: `PROJECT.md` `## 버전·도구 정책` 첫 번째 항목("테스트 프레임워크 이원화")
  - 상세: 기존 문장("packages/* 의 vitest 이행은 ... 트리거 전까지 보류한다")을 반증하지 않고, 그 트리거가 실제로 발화했다는 사실과 처리 결과(이행 대신 2줄 config 변경)를 이어 붙였다. "적용·검증된 것은 backend 뿐이고 packages/* 에서는 아직 재지 않았다"는 경계까지 명시해, 다음 사람이 "트리거 발화 = packages/* 도 이미 이행 완료"로 오독할 소지를 막았다. `plan/in-progress/jest-esm-native-load.md` §"PROJECT.md 교차 참조 (INFO 5)" 절과 문구가 정확히 대응한다.
  - 제안: 없음. 다만 이 항목은 원문을 반증한 것이 아니라 후속 사실을 덧붙인 것이라, `CLAUDE.md` §자기-반증형 소정정(원문 취소선 보존 요구)의 적용 대상은 아닌 것으로 판단된다 — 참고로 남긴다.

- **[INFO]** README·CHANGELOG 갱신 불요 판정이 근거를 가짐
  - 위치: `codebase/backend/README.md:21-23` (스크립트 표), `PROJECT.md` `## 변경 유형 → 갱신 위치 매핑` 표
  - 상세: `npm run test`/`test:e2e`/`test:cov` 스크립트 *이름*은 이번 PR 로 바뀌지 않았고(내부 호출 방식만 변경) README 표는 이름만 나열하므로 갱신 대상이 아니다. `PROJECT.md` 매핑 표에도 "테스트 러너/빌드 도구 설정 변경" 에 대응하는 행이 없어 CHANGELOG.md 항목 의무도 없다 — 이 판정 기준 자체가 문서화되어 있지 않다는 메타 이슈는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(§ "CHANGELOG 「해당 없음」 판정에 성문 근거가 없다", 2026-09-24 등재)에 별도 백로그로 정확히 기록되어 있어 중복 지적하지 않는다.
  - 제안: 없음 (이미 추적됨).

- **[INFO]** 전수 확인한 카운트·목록이 실제 파일과 일치
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(신규 체크리스트 항목, "12개" 파일 목록)
  - 상세: `.github/workflows/frontend-checks.yml` 의 `pathspecs:` 블록을 직접 열어 주석을 제외한 실제 경로 12개(코드 fence 안 목록과 정확히 일치)를 셌다 — 이 문서가 "처음엔 8개로 적었다가 반증됐다"고 자기 정정한 내용이 이번엔 정확함을 확인했다.
  - 제안: 없음.

## 요약

이번 diff(backend jest ESM 네이티브 로드 전환 + `@nestjs/typeorm@12` 선행 조건 plan)는 문서화 관점에서 이례적으로 높은 완성도를 보인다. `jest.config.ts` 헤더/인라인 주석은 변경된 설정과 정확히 일치하고, 신설된 가드 스펙(`esm-native-load.spec.ts`)은 트립와이어 메커니즘·불변식·자신이 덮지 못하는 범위(스크립트 우회 호출)까지 스스로 명시한다. `PROJECT.md`의 정책 문단 갱신은 과거 예고를 반증 없이 사실로 보강했고 적용 범위(backend만, packages/*는 미검증)를 정확히 한정했다. README/CHANGELOG 갱신 불요 판정도 근거가 있으며, 그 판정 기준 자체의 문서화 부재는 이미 별도 plan 항목으로 추적 중이라 중복 지적 대상이 아니다. 직접 재현(grep 실측, 파일 대조, 정책 문서 교차 확인)한 모든 주장에서 부정확한 서술을 찾지 못했다. 새로운 CRITICAL/WARNING 없음.

## 위험도
NONE

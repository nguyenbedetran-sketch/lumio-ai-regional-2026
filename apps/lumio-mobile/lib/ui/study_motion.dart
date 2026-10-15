import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../core/motion.dart';

class MotionScope extends InheritedWidget {
  const MotionScope({
    super.key,
    required this.preference,
    required super.child,
  });
  final MotionPreference preference;
  @override
  bool updateShouldNotify(MotionScope oldWidget) =>
      oldWidget.preference != preference;
}

MotionLevel motionLevel(BuildContext context) {
  final media = MediaQuery.of(context);
  return resolveMotion(
    context.dependOnInheritedWidgetOfExactType<MotionScope>()?.preference ??
        MotionPreference.auto,
    disableAnimations: media.disableAnimations,
    accessibleNavigation: media.accessibleNavigation,
  );
}

Duration motionDuration(BuildContext context, [int milliseconds = 300]) =>
    switch (motionLevel(context)) {
      MotionLevel.none => Duration.zero,
      MotionLevel.subtle => Duration(milliseconds: math.min(milliseconds, 160)),
      MotionLevel.full => Duration(milliseconds: milliseconds),
    };

/// Finite entry or action feedback; reduced motion bypasses the ticker entirely.
class StudyMotion extends StatelessWidget {
  const StudyMotion({
    super.key,
    required this.child,
    this.feedback = false,
    this.order = 0,
  });
  final Widget child;
  final bool feedback;
  final int order;
  @override
  Widget build(BuildContext context) {
    final level = motionLevel(context);
    if (level == MotionLevel.none) return child;
    final animation = child
        .animate(
          delay: level == MotionLevel.full
              ? Duration(milliseconds: math.min(order, 4) * 45)
              : Duration.zero,
        )
        .fadeIn(duration: motionDuration(context, 240), curve: Curves.easeOut);
    if (level == MotionLevel.subtle) return animation;
    if (feedback) {
      return animation.scaleXY(
        begin: .96,
        end: 1,
        duration: motionDuration(context, 360),
        curve: Curves.easeOutCubic,
      );
    }
    return animation.moveY(
      begin: 14,
      end: 0,
      duration: motionDuration(context, 380),
      curve: Curves.easeOutCubic,
    );
  }
}

/// Reveals the selected tab without replacing its widget or losing its draft.
class TabReveal extends StatefulWidget {
  const TabReveal({super.key, required this.active, required this.child});
  final bool active;
  final Widget child;
  @override
  State<TabReveal> createState() => _TabRevealState();
}

class _TabRevealState extends State<TabReveal>
    with SingleTickerProviderStateMixin {
  late final controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 300),
    value: 1,
  );
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (motionLevel(context) == MotionLevel.none) {
      controller.stop();
      controller.value = 1;
    }
  }

  @override
  void didUpdateWidget(TabReveal oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.active && widget.active) {
      controller.duration = motionDuration(context, 300);
      if (motionLevel(context) == MotionLevel.none) {
        controller.value = 1;
      } else {
        controller.forward(from: 0);
      }
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (motionLevel(context) == MotionLevel.none) return widget.child;
    return AnimatedBuilder(
      animation: controller,
      child: widget.child,
      builder: (context, child) => Opacity(
        opacity: Curves.easeOut.transform(controller.value),
        child: Transform.translate(
          offset: Offset(
            0,
            motionLevel(context) == MotionLevel.full
                ? (1 - Curves.easeOutCubic.transform(controller.value)) * 10
                : 0,
          ),
          child: child,
        ),
      ),
    );
  }
}

/// Only the visible face exists in the accessibility tree.
class CardReveal extends StatelessWidget {
  const CardReveal({
    super.key,
    required this.flipped,
    required this.front,
    required this.back,
  });
  final bool flipped;
  final Widget front, back;
  @override
  Widget build(BuildContext context) {
    if (motionLevel(context) != MotionLevel.full) {
      return Semantics(liveRegion: flipped, child: flipped ? back : front);
    }
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: flipped ? 1 : 0),
      duration: motionDuration(context, 440),
      curve: Curves.easeInOutCubic,
      builder: (context, value, _) {
        final showBack = value >= .5;
        final transform = Matrix4.identity()
          ..setEntry(3, 2, .001)
          ..rotateY(math.pi * value);
        return Transform(
          alignment: Alignment.center,
          transform: transform,
          child: Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()..rotateY(showBack ? math.pi : 0),
            child: Semantics(
              liveRegion: showBack,
              child: showBack ? back : front,
            ),
          ),
        );
      },
    );
  }
}

class LumioPageTransitions extends PageTransitionsBuilder {
  const LumioPageTransitions();
  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final level = motionLevel(context);
    if (level == MotionLevel.none) return child;
    final curved = animation.drive(CurveTween(curve: Curves.easeOutCubic));
    return FadeTransition(
      opacity: curved,
      child: level == MotionLevel.subtle
          ? child
          : SlideTransition(
              position: Tween(
                begin: const Offset(0, .035),
                end: Offset.zero,
              ).animate(curved),
              child: child,
            ),
    );
  }
}
